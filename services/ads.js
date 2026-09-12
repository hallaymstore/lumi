const crypto = require('crypto');
const AdCampaign = require('../models/AdCampaign');
const AdEvent = require('../models/AdEvent');
const AdConfig = require('../models/AdConfig');
const NetworkAdEvent = require('../models/NetworkAdEvent');
const FeedEvent = require('../models/FeedEvent');

function clamp(n, min, max, fallback) {
  n = Number(n);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

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
  const config = await AdConfig.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  if (!Number.isFinite(Number(config.networkEcpm))) config.networkEcpm = 0.5;
  if (typeof config.smartDelivery !== 'boolean') config.smartDelivery = true;
  config.firstAdMin = clamp(config.firstAdMin, 3, 12, 5);
  config.firstAdMax = clamp(config.firstAdMax, config.firstAdMin, 14, 6);
  config.gapMin = clamp(config.gapMin, 3, 15, 4);
  config.gapMax = clamp(config.gapMax, config.gapMin, 20, 7);
  config.maxAdsPerPage = clamp(config.maxAdsPerPage, 1, 20, 6);
  return config;
}

function decorate(ad, extra = {}) {
  let domain = 'Hamkor sayt';
  try { domain = new URL(ad.clickUrl).hostname.replace(/^www\./, ''); } catch (_) {}
  return { ...ad, domain, ...extra };
}

function stableNoise(seed) {
  const hex = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

function normalizeTag(value) {
  return String(value || '').toLowerCase().trim().replace(/^#/, '').slice(0, 48);
}

const interestCache = new Map();
async function getInterestProfile(userId) {
  if (!userId) return new Map();
  const key = String(userId);
  const cached = interestCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.map;

  const since = new Date(Date.now() - 60 * 864e5);
  const rows = await FeedEvent.find({ user: userId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 }).limit(1800).select('type value tags createdAt').lean();

  const W = {
    view: .7, dwell: .035, like: 4, unlike: -3, comment: 5.5, save: 7.5,
    unsave: -5, share: 9, open_comments: 2.2, not_interested: -12, impression: -.05
  };
  const map = new Map();
  for (const row of rows) {
    const days = Math.max(0, (Date.now() - new Date(row.createdAt).getTime()) / 864e5);
    const decay = Math.exp(-days / 32);
    const mult = row.type === 'dwell' ? Math.min(90, Math.max(0, Number(row.value) || 0)) : 1;
    const score = (W[row.type] || 0) * mult * decay;
    for (const raw of row.tags || []) {
      const tag = normalizeTag(raw);
      if (tag) map.set(tag, (map.get(tag) || 0) + score);
    }
  }

  interestCache.set(key, { at: Date.now(), map });
  if (interestCache.size > 1500) {
    const oldest = [...interestCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 250);
    for (const [k] of oldest) interestCache.delete(k);
  }
  return map;
}

async function getRecentAdHistory(userId, campaignIds) {
  const result = new Map();
  if (!userId || !campaignIds.length) return result;
  const since = new Date(Date.now() - 7 * 864e5);
  const rows = await AdEvent.find({
    user: userId,
    campaign: { $in: campaignIds },
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 }).select('campaign type createdAt').lean();

  for (const row of rows) {
    const key = String(row.campaign);
    const item = result.get(key) || { impressions: [], clicks: 0, dismissals: [] };
    if (row.type === 'impression') item.impressions.push(new Date(row.createdAt));
    else if (row.type === 'click') item.clicks += 1;
    else if (row.type === 'dismiss') item.dismissals.push(new Date(row.createdAt));
    result.set(key, item);
  }
  return result;
}

function scoreCampaign(ad, interests, history, seed) {
  const tags = [...new Set([normalizeTag(ad.category), ...(ad.targetTags || []).map(normalizeTag)].filter(Boolean))];
  let interestRaw = 0;
  const matched = [];
  for (const tag of tags) {
    const affinity = Number(interests.get(tag) || 0);
    if (affinity > 0) {
      interestRaw += Math.min(30, affinity);
      matched.push(tag);
    } else if (affinity < 0) {
      interestRaw += Math.max(-16, affinity * .5);
    }
  }

  const globalCtr = (Number(ad.clicks || 0) + 1.5) / (Number(ad.impressions || 0) + 45);
  const ageDays = Math.max(0, (Date.now() - new Date(ad.createdAt || Date.now()).getTime()) / 864e5);
  const recent7 = history?.impressions?.length || 0;
  const dismiss7 = history?.dismissals?.length || 0;

  let score = Number(ad.priority || 5) * 2.5;
  score += tags.length ? Math.max(-18, Math.min(42, interestRaw * .65)) : 5;
  score += Math.min(11, globalCtr * 110);
  score += 5 * Math.exp(-ageDays / 18);
  score -= recent7 * 4.5;
  score -= dismiss7 * 13;
  score += stableNoise(`${seed}:${ad._id}`) * 6;

  return { score, matched };
}

async function getAdsForPlacement(placement, user, limit = 8) {
  const now = new Date();
  const audience = user ? ['all', 'members'] : ['all', 'guests'];
  const wanted = Math.max(1, Math.min(20, Number(limit) || 8));

  const rows = await AdCampaign.find({
    status: 'active', placements: placement, audience: { $in: audience }, startsAt: { $lte: now },
    $and: [
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      { $or: [{ budget: { $lte: 0 } }, { $expr: { $lt: ['$spent', '$budget'] } }] }
    ]
  }).sort({ priority: -1, updatedAt: -1 }).limit(80).lean();

  if (!rows.length) return [];

  const userId = user?._id || null;
  const [interests, historyMap] = await Promise.all([
    getInterestProfile(userId),
    getRecentAdHistory(userId, rows.map(x => x._id))
  ]);

  const dayAgo = new Date(Date.now() - 864e5);
  const seed = `${userId || 'guest'}:${placement}:${Math.floor(Date.now() / 36e5)}`;

  const ranked = [];
  for (const ad of rows) {
    const history = historyMap.get(String(ad._id)) || { impressions: [], clicks: 0, dismissals: [] };
    const cap = clamp(ad.dailyFrequencyCap, 1, 20, 3);
    const cooldownHours = clamp(ad.cooldownHours, 0, 168, 6);
    const dismissCooldownHours = clamp(ad.dismissCooldownHours, 1, 720, 72);

    if (userId) {
      const todayCount = history.impressions.filter(d => d >= dayAgo).length;
      if (todayCount >= cap) continue;

      if (cooldownHours > 0 && history.impressions[0] &&
          Date.now() - history.impressions[0].getTime() < cooldownHours * 36e5) continue;

      if (history.dismissals[0] &&
          Date.now() - history.dismissals[0].getTime() < dismissCooldownHours * 36e5) continue;
    }

    const scored = scoreCampaign(ad, interests, history, seed);
    ranked.push(decorate(ad, {
      _adScore: Math.round(scored.score * 100) / 100,
      _matchedTags: scored.matched,
      dailyFrequencyCap: cap,
      cooldownHours,
      dismissCooldownHours
    }));
  }

  ranked.sort((a, b) => b._adScore - a._adScore);
  return ranked.slice(0, wanted);
}

function randInt(seed, min, max) {
  min = Math.floor(min); max = Math.floor(max);
  if (max <= min) return min;
  return min + Math.floor(stableNoise(seed) * (max - min + 1));
}

function buildFeedAdPositions(postCount, config = {}, seed = Date.now()) {
  const total = Math.max(0, Number(postCount) || 0);
  const configuredCap = clamp(config.maxAdsPerPage, 1, 20, 6);
  const cap = config.smartDelivery === false ? configuredCap : Math.min(configuredCap, 6);
  if (!total || !config.enabled) return [];

  if (config.smartDelivery === false) {
    const every = clamp(config.feedInterval, 3, 20, 5);
    const out = [];
    for (let n = every; n <= total && out.length < cap; n += every) out.push(n);
    return out;
  }

  const firstMin = clamp(config.firstAdMin, 3, 12, 5);
  const firstMax = clamp(config.firstAdMax, firstMin, 14, 6);
  const gapMin = clamp(config.gapMin, 3, 15, 4);
  const gapMax = clamp(config.gapMax, gapMin, 20, 7);

  let cursor = randInt(`${seed}:first`, firstMin, firstMax);
  const positions = [];
  let step = 0;
  while (cursor <= total && positions.length < cap) {
    positions.push(cursor);
    cursor += randInt(`${seed}:gap:${step++}`, gapMin, gapMax);
  }
  return positions;
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

module.exports = {
  getAdConfig,
  getAdsForPlacement,
  buildFeedAdPositions,
  recordAdEvent,
  recordNetworkAdEvent
};
