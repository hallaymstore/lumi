const router = require('express').Router();
const multer = require('multer');
const AdCampaign = require('../models/AdCampaign');
const AdEvent = require('../models/AdEvent');
const AdConfig = require('../models/AdConfig');
const NetworkAdEvent = require('../models/NetworkAdEvent');
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

// Accurate monetization center: only genuine provider creatives count as
// network impressions. No-fill/ad-block attempts remain visible separately.
router.get('/admin/ads', requireAuth, requireAdmin, async (req, res) => {
  const since = new Date(Date.now() - 7 * 864e5);
  const [campaigns, config, summary, daily, networkSummary, networkDaily, networkPlacements] = await Promise.all([
    AdCampaign.find().sort({ status: 1, priority: -1, updatedAt: -1 }).lean(),
    getAdConfig(),
    AdCampaign.aggregate([{ $group: { _id: null, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' }, revenue: { $sum: '$revenue' }, budget: { $sum: '$budget' } } }]),
    AdEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' }, count: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
      { $sort: { '_id.day': 1 } }
    ]),
    NetworkAdEvent.aggregate([{ $group: {
      _id: null,
      providerImpressions: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'impression'] }, { $eq: ['$providerState', 'provider'] }] }, 1, 0] } },
      fallbacks: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'impression'] }, { $eq: ['$providerState', 'fallback'] }] }, 1, 0] } },
      clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
      revenue: { $sum: '$revenue' }
    } }]),
    NetworkAdEvent.aggregate([
      { $match: { createdAt: { $gte: since }, $or: [{ type: 'click' }, { type: 'impression', providerState: 'provider' }] } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' }, count: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
      { $sort: { '_id.day': 1 } }
    ]),
    NetworkAdEvent.aggregate([{ $group: {
      _id: '$placement',
      impressions: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'impression'] }, { $eq: ['$providerState', 'provider'] }] }, 1, 0] } },
      clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
      revenue: { $sum: '$revenue' }
    } }, { $sort: { impressions: -1 } }])
  ]);

  const internalTotals = summary[0] || { impressions: 0, clicks: 0, revenue: 0, budget: 0 };
  const rawNetwork = networkSummary[0] || { providerImpressions: 0, fallbacks: 0, clicks: 0, revenue: 0 };
  const networkTotals = {
    impressions: Number(rawNetwork.providerImpressions || 0),
    providerImpressions: Number(rawNetwork.providerImpressions || 0),
    fallbacks: Number(rawNetwork.fallbacks || 0),
    clicks: Number(rawNetwork.clicks || 0),
    revenue: Number(rawNetwork.revenue || 0)
  };
  networkTotals.ctr = networkTotals.impressions ? networkTotals.clicks / networkTotals.impressions * 100 : 0;

  const totals = {
    impressions: Number(internalTotals.impressions || 0) + networkTotals.impressions,
    clicks: Number(internalTotals.clicks || 0) + networkTotals.clicks,
    revenue: Number(internalTotals.revenue || 0) + networkTotals.revenue,
    budget: Number(internalTotals.budget || 0)
  };
  totals.ctr = totals.impressions ? totals.clicks / totals.impressions * 100 : 0;

  res.set('Cache-Control', 'no-store');
  res.render('admin/ads', {
    title: 'Reklama markazi', campaigns, config, totals, internalTotals, daily,
    networkTotals, networkDaily, networkPlacements
  });
});

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
