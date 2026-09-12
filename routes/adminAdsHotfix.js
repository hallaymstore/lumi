const router = require('express').Router();
const multer = require('multer');
const AdCampaign = require('../models/AdCampaign');
const AdConfig = require('../models/AdConfig');
const AdminLog = require('../models/AdminLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadFile, deleteMany } = require('../services/r2');

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

function campaignValue(req) {
  const placementInput = Array.isArray(req.body.placements)
    ? req.body.placements
    : [req.body.placements].filter(Boolean);
  const placements = placementInput.filter(x => AdCampaign.PLACEMENTS.includes(x));

  let clickUrl;
  try {
    clickUrl = new URL(String(req.body.clickUrl || ''));
    if (!['http:', 'https:'].includes(clickUrl.protocol)) throw new Error();
  } catch (_) {
    throw new Error("Reklama havolasi http:// yoki https:// bilan boshlansin.");
  }

  const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
  const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (endsAt && endsAt <= startsAt) throw new Error('Tugash vaqti boshlanish vaqtidan keyin bo‘lsin.');
  if (!placements.length) throw new Error('Kamida bitta reklama joylashuvini tanlang.');

  return {
    name: String(req.body.name || '').trim().slice(0, 80),
    advertiserName: String(req.body.advertiserName || '').trim().slice(0, 80),
    title: String(req.body.title || '').trim().slice(0, 100),
    body: String(req.body.body || '').trim().slice(0, 260),
    clickUrl: clickUrl.toString(),
    ctaText: String(req.body.ctaText || "Saytga o'tish").trim().slice(0, 32),
    placements,
    audience: ['all', 'guests', 'members'].includes(req.body.audience) ? req.body.audience : 'all',
    status: ['draft', 'active', 'paused', 'ended'].includes(req.body.status) ? req.body.status : 'draft',
    startsAt,
    endsAt,
    priority: Math.min(10, Math.max(1, Number(req.body.priority) || 5)),
    priceModel: ['cpm', 'cpc', 'flat'].includes(req.body.priceModel) ? req.body.priceModel : 'cpm',
    unitPrice: Math.max(0, Number(req.body.unitPrice) || 0),
    budget: Math.max(0, Number(req.body.budget) || 0),
    updatedBy: req.currentUser._id
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

// A GET on this URL used to fall into the broken campaign edit flow. Send admins
// back to the monetization center instead of ever treating "settings" as an ObjectId.
router.get('/admin/ads/settings', requireAuth, requireAdmin, (req, res) => {
  res.redirect('/admin/ads');
});

// This exact route MUST run before /admin -> /ads/:id. It also recovers a campaign
// submitted from the stale broken page that previously used _id="settings".
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

    await AdConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          enabled: req.body.enabled === 'on',
          feedInterval: Math.min(20, Math.max(3, Number(req.body.feedInterval) || 5)),
          ctaDelaySeconds: Math.min(10, Math.max(1, Number(req.body.ctaDelaySeconds) || 3)),
          maxAdsPerPage: Math.min(20, Math.max(1, Number(req.body.maxAdsPerPage) || 8)),
          profileEnabled: req.body.profileEnabled === 'on',
          chatsEnabled: req.body.chatsEnabled === 'on',
          networkEnabled: req.body.networkEnabled === 'on',
          networkEcpm: Math.min(100, Math.max(0, Number(req.body.networkEcpm) || 0)),
          label: String(req.body.label || 'Reklama').trim().slice(0, 24),
          updatedBy: req.currentUser._id
        }
      },
      { upsert: true }
    );
    await logAction(req, 'ad.settings', 'ad_config', 'global', 'Reklama sozlamalari yangilandi');
    return res.redirect('/admin/ads');
  } catch (error) {
    if (uploaded) deleteMany([uploaded.key, uploaded.thumbKey]).catch(() => {});

    if (looksLikeCampaign(req.body)) {
      return res.status(400).render('admin/ad-form', {
        title: 'Yangi reklama',
        campaign: {
          ...req.body,
          placements: Array.isArray(req.body.placements)
            ? req.body.placements
            : [req.body.placements].filter(Boolean)
        },
        error: error.message || 'Reklama saqlanmadi.'
      });
    }

    console.error('Ad settings hotfix:', error);
    return res.status(500).render('error', {
      title: 'Xatolik',
      message: 'Reklama sozlamalari saqlanmadi.'
    });
  }
});

module.exports = router;
