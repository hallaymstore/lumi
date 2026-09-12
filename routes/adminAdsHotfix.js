const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const AdCampaign = require('../models/AdCampaign');
const AdConfig = require('../models/AdConfig');
const AdminLog = require('../models/AdminLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadFile, deleteMany } = require('../services/r2');
const { getAdConfig } = require('../services/ads');

const adUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype))
});

async function logAction(req, action, targetType = '', targetId = '', details = '') {
  await AdminLog.create({
    admin: req.currentUser._id,
    action,
    targetType,
    targetId: String(targetId || ''),
    details: String(details || '').slice(0, 240)
  }).catch(() => {});
}

function clamp(n, min, max, fallback) {
  n = Number(n);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function parseTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map(x => String(x || '').toLowerCase().trim().replace(/^#/, '').slice(0, 48)).filter(Boolean))].slice(0, 20);
}

function campaignValue(req, existing = {}) {
  const placementInput = Array.isArray(req.body.placements)
    ? req.body.placements
    : [req.body.placements].filter(Boolean);
  const placements = placementInput.filter(x => AdCampaign.PLACEMENTS.includes(x));

  let clickUrl;
  try {
    clickUrl = new URL(String(req.body.clickUrl || existing.clickUrl || ''));
    if (!['http:', 'https:'].includes(clickUrl.protocol)) throw new Error();
  } catch (_) {
    throw new Error("Reklama havolasi http:// yoki https:// bilan boshlansin.");
  }

  const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : (existing.startsAt || new Date());
  const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    throw new Error('Reklama sanasi noto‘g‘ri.');
  }
  if (endsAt && endsAt <= startsAt) throw new Error('Tugash vaqti boshlanish vaqtidan keyin bo‘lsin.');
  if (!placements.length) throw new Error('Kamida bitta reklama joylashuvini tanlang.');

  return {
    name: String(req.body.name || '').trim().slice(0, 80),
    advertiserName: String(req.body.advertiserName || '').trim().slice(0, 80),
    title: String(req.body.title || '').trim().slice(0, 100),
    body: String(req.body.body || '').trim().slice(0, 260),
    clickUrl: clickUrl.toString(),
    ctaText: String(req.body.ctaText || "Saytga o'tish").trim().slice(0, 32),

    category: String(req.body.category || '').toLowerCase().trim().replace(/^#/, '').slice(0, 48),
    targetTags: parseTags(req.body.targetTags),
    dailyFrequencyCap: clamp(req.body.dailyFrequencyCap, 1, 20, 3),
    cooldownHours: clamp(req.body.cooldownHours, 0, 168, 6),
    dismissCooldownHours: clamp(req.body.dismissCooldownHours, 1, 720, 72),

    placements,
    audience: ['all', 'guests', 'members'].includes(req.body.audience) ? req.body.audience : 'all',
    status: ['draft', 'active', 'paused', 'ended'].includes(req.body.status) ? req.body.status : 'draft',
    startsAt,
    endsAt,
    priority: clamp(req.body.priority, 1, 10, 5),
    priceModel: ['cpm', 'cpc', 'flat'].includes(req.body.priceModel) ? req.body.priceModel : 'cpm',
    unitPrice: Math.max(0, Number(req.body.unitPrice) || 0),
    budget: Math.max(0, Number(req.body.budget) || 0),
    updatedBy: req.currentUser._id
  };
}

function campaignDraft(req, extra = {}) {
  return {
    ...extra,
    ...req.body,
    targetTags: parseTags(req.body.targetTags),
    placements: Array.isArray(req.body.placements)
      ? req.body.placements
      : [req.body.placements].filter(Boolean)
  };
}

function looksLikeCampaign(body = {}) {
  return Boolean(
    String(body.name || '').trim() ||
    String(body.advertiserName || '').trim() ||
    String(body.title || '').trim() ||
    String(body.clickUrl || '').trim()
  );
}

async function renderAdForm(req, res, { campaign = null, error = null, status = 200 } = {}) {
  return res.status(status).render('admin/ad-form', {
    title: campaign?._id ? 'Reklamani tahrirlash' : 'Yangi reklama',
    campaign,
    error
  });
}

router.get('/admin/api/ad-smart-config', requireAuth, requireAdmin, async (req, res) => {
  const config = await getAdConfig();
  res.set('Cache-Control', 'no-store').json({
    smartDelivery: config.smartDelivery !== false,
    firstAdMin: config.firstAdMin || 5,
    firstAdMax: config.firstAdMax || 6,
    gapMin: config.gapMin || 4,
    gapMax: config.gapMax || 7,
    maxAdsPerPage: config.maxAdsPerPage || 6
  });
});

router.get('/admin/ads/settings', requireAuth, requireAdmin, (req, res) => {
  res.redirect('/admin/ads');
});

router.post('/admin/ads/settings', requireAuth, requireAdmin, adUpload.single('image'), async (req, res) => {
  let uploaded = null;
  try {
    if (looksLikeCampaign(req.body)) {
      const data = campaignValue(req);
      if (!req.file) throw new Error('Reklama rasmi tanlanishi kerak.');
      uploaded = await uploadFile(req.file, 'ads', { maxEdge: 1600, quality: 86 });
      const campaign = await AdCampaign.create({
        ...data,
        imageUrl: uploaded.url,
        imageKey: uploaded.key,
        thumbUrl: uploaded.thumbUrl || uploaded.url,
        thumbKey: uploaded.thumbKey || '',
        createdBy: req.currentUser._id
      });
      await logAction(req, 'ad.create.recovered', 'ad', campaign._id, campaign.name);
      return res.redirect('/admin/ads');
    }

    const currentConfig = await getAdConfig();
    const firstMin = clamp(req.body.firstAdMin, 3, 12, currentConfig.firstAdMin || 5);
    const firstMax = clamp(req.body.firstAdMax, firstMin, 14, currentConfig.firstAdMax || 6);
    const gapMin = clamp(req.body.gapMin, 3, 15, currentConfig.gapMin || 4);
    const gapMax = clamp(req.body.gapMax, gapMin, 20, currentConfig.gapMax || 7);
    const smartDelivery = req.body.smartDelivery === undefined
      ? currentConfig.smartDelivery !== false
      : req.body.smartDelivery === 'on';

    await AdConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          enabled: req.body.enabled === 'on',
          feedInterval: clamp(req.body.feedInterval, 3, 20, 5),
          smartDelivery,
          firstAdMin: firstMin,
          firstAdMax: firstMax,
          gapMin,
          gapMax,
          ctaDelaySeconds: clamp(req.body.ctaDelaySeconds, 1, 10, 3),
          maxAdsPerPage: clamp(req.body.maxAdsPerPage, 1, 20, 6),
          profileEnabled: req.body.profileEnabled === 'on',
          chatsEnabled: req.body.chatsEnabled === 'on',
          networkEnabled: req.body.networkEnabled === 'on',
          networkEcpm: clamp(req.body.networkEcpm, 0, 100, 0),
          label: String(req.body.label || 'Reklama').trim().slice(0, 24),
          updatedBy: req.currentUser._id
        }
      },
      { upsert: true }
    );
    await logAction(req, 'ad.settings', 'ad_config', 'global', 'Smart Ad Delivery sozlamalari yangilandi');
    return res.redirect('/admin/ads');
  } catch (error) {
    if (uploaded) deleteMany([uploaded.key, uploaded.thumbKey]).catch(() => {});
    if (looksLikeCampaign(req.body)) {
      return renderAdForm(req, res, {
        campaign: campaignDraft(req),
        error: error.message || 'Reklama saqlanmadi.',
        status: 400
      });
    }
    console.error('Ad settings:', error);
    return res.status(500).render('error', { title: 'Xatolik', message: 'Reklama sozlamalari saqlanmadi.' });
  }
});

router.post('/admin/ads', requireAuth, requireAdmin, adUpload.single('image'), async (req, res) => {
  let uploaded = null;
  try {
    const data = campaignValue(req);
    if (!req.file) throw new Error('Reklama rasmi tanlanishi kerak.');
    uploaded = await uploadFile(req.file, 'ads', { maxEdge: 1600, quality: 86 });
    const campaign = await AdCampaign.create({
      ...data,
      imageUrl: uploaded.url,
      imageKey: uploaded.key,
      thumbUrl: uploaded.thumbUrl || uploaded.url,
      thumbKey: uploaded.thumbKey || '',
      createdBy: req.currentUser._id
    });
    await logAction(req, 'ad.create.smart', 'ad', campaign._id, campaign.name);
    return res.redirect('/admin/ads');
  } catch (error) {
    if (uploaded) deleteMany([uploaded.key, uploaded.thumbKey]).catch(() => {});
    return renderAdForm(req, res, {
      campaign: campaignDraft(req),
      error: error.message || 'Reklama saqlanmadi.',
      status: 400
    });
  }
});

router.post('/admin/ads/:id', requireAuth, requireAdmin, adUpload.single('image'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  let uploaded = null;
  try {
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) return res.sendStatus(404);

    const data = campaignValue(req, campaign);
    const oldKeys = [];
    if (req.file) {
      uploaded = await uploadFile(req.file, 'ads', { maxEdge: 1600, quality: 86 });
      data.imageUrl = uploaded.url;
      data.imageKey = uploaded.key;
      data.thumbUrl = uploaded.thumbUrl || uploaded.url;
      data.thumbKey = uploaded.thumbKey || '';
      oldKeys.push(campaign.imageKey, campaign.thumbKey);
    }

    Object.assign(campaign, data);
    await campaign.save();
    if (oldKeys.length) deleteMany(oldKeys).catch(() => {});
    await logAction(req, 'ad.update.smart', 'ad', campaign._id, campaign.name);
    return res.redirect('/admin/ads');
  } catch (error) {
    if (uploaded) deleteMany([uploaded.key, uploaded.thumbKey]).catch(() => {});
    const existing = await AdCampaign.findById(req.params.id).lean().catch(() => null);
    return renderAdForm(req, res, {
      campaign: campaignDraft(req, { _id: req.params.id, imageUrl: existing?.imageUrl, thumbUrl: existing?.thumbUrl }),
      error: error.message || 'Reklama yangilanmadi.',
      status: 400
    });
  }
});

module.exports = router;
