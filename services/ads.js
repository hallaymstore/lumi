const crypto = require('crypto');
const AdCampaign = require('../models/AdCampaign');
const AdEvent = require('../models/AdEvent');
const AdConfig = require('../models/AdConfig');
const NetworkAdEvent = require('../models/NetworkAdEvent');

function getCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function visitorKey(req, res) {
  if (req.currentUser) return `u:${req.currentUser._id}`;
  let id = getCookie(req, 'lumi_ad_vid');
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    id = crypto.randomBytes(16).toString('hex');
    res.cookie('lumi_ad_vid', id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 365 });
  }
  const salt = process.env.VIEW_HASH_SALT || process.env.SESSION_SECRET || 'lumi-ad-salt';
  return `g:${crypto.createHash('sha256').update(id + salt).digest('hex').slice(0, 40)}`;
}

async function getAdConfig() {
  const config = await AdConfig.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  if (!Number.isFinite(Number(config.networkEcpm))) config.networkEcpm = 0.5;
  return config;
}

function decorate(ad) {
  let domain = 'Hamkor sayt';
  try { domain = new URL(ad.clickUrl).hostname.replace(/^www\./, ''); } catch (_) {}
  return { ...ad, domain };
}

async function getAdsForPlacement(placement, user, limit = 8) {
  const now = new Date();
  const audience = user ? ['all', 'members'] : ['all', 'guests'];
  const rows = await AdCampaign.find({
    status: 'active', placements: placement, audience: { $in: audience }, startsAt: { $lte: now },
    $and: [
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      { $or: [{ budget: { $lte: 0 } }, { $expr: { $lt: ['$spent', '$budget'] } }] }
    ]
  }).sort({ priority: -1, updatedAt: -1 }).limit(Math.max(1, Math.min(20, Number(limit) || 8))).lean();
  return rows.map(decorate);
}

function eventBucket(type) {
  const minutes = type === 'click' ? 30 : type === 'impression' ? 30 : 5;
  return String(Math.floor(Date.now() / (minutes * 60 * 1000)));
}

async function recordAdEvent(req, res, campaign, type, placement) {
  const viewer = visitorKey(req, res);
  const revenue = type === 'impression' && campaign.priceModel === 'cpm'
    ? Number(campaign.unitPrice || 0) / 1000
    : type === 'click' && campaign.priceModel === 'cpc' ? Number(campaign.unitPrice || 0) : 0;
  try {
    await AdEvent.create({ campaign: campaign._id, user: req.currentUser?._id || null, viewerKey: viewer, type, placement, bucket: eventBucket(type), revenue });
  } catch (error) {
    if (error?.code === 11000) return { counted: false, revenue: 0 };
    throw error;
  }
  const inc = { [type === 'impression' ? 'impressions' : type === 'click' ? 'clicks' : 'dismissals']: 1 };
  if (revenue) { inc.revenue = revenue; inc.spent = revenue; }
  await AdCampaign.updateOne({ _id: campaign._id }, { $inc: inc });
  return { counted: true, revenue };
}

async function recordNetworkAdEvent(req, res, { type, placement, format, providerState }) {
  const viewer = visitorKey(req, res);
  const config = await getAdConfig();
  const revenue = type === 'impression' && providerState === 'provider' ? Number(config.networkEcpm || 0) / 1000 : 0;
  try {
    await NetworkAdEvent.create({
      user: req.currentUser?._id || null, viewerKey: viewer, type, placement, format,
      providerState, bucket: eventBucket(type), revenue
    });
  } catch (error) {
    if (error?.code === 11000) return { counted: false, revenue: 0 };
    throw error;
  }
  return { counted: true, revenue };
}

module.exports = { getAdConfig, getAdsForPlacement, recordAdEvent, recordNetworkAdEvent };
