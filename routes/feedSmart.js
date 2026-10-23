const router = require('express').Router();
const User = require('../models/User');
const { buildFeed, hydrateFeedPosts } = require('../services/feed');
const feedSession = require('../services/feedSession');
const { planFeedAds } = require('../services/feedAds');
const { getStoryPeople, getGuestStoryPeople, getShareTargets } = require('../utils/socialUi');
const { decoratePosts } = require('../utils/socialState');
const { getAdConfig, getAdsForPlacement } = require('../services/ads');

const MODES = ['foryou', 'following', 'new'];
const PAGE_SIZE = 12;   // posts per rendered page: small first paint, endless scroll afterwards
const DEPTH = 96;       // ranked posts kept per feed session (8 pages)
const modeOf = q => (MODES.includes(q) ? q : 'foryou');

async function rankedFeed(me, mode, nonce) {
  const posts = await buildFeed(me, { mode, limit: DEPTH, nonce, interests: me?.interests || [] });
  feedSession.put(me?._id, mode, nonce, posts.map(p => p._id));
  return posts;
}

// Mounted before routes/social.js so this production feed route owns Smart Ad Delivery.
router.get('/feed', async (req, res, next) => {
  try {
    const mode = modeOf(req.query.tab);
    const me = req.currentUser ? await User.findById(req.currentUser._id).lean() : null;
    const given = feedSession.cleanNonce(req.query.refresh || req.query.fresh);
    // "Back" from a post: the client re-opens the same nonce, so we serve the exact ranked session again.
    const cachedIds = given ? feedSession.get(me?._id, mode, given) : null;
    let nonce = given || String(Date.now()), shown, hasMorePosts;
    if (cachedIds) {
      const rows = await hydrateFeedPosts(me, cachedIds.slice(0, PAGE_SIZE));
      shown = rows; hasMorePosts = cachedIds.length > PAGE_SIZE;
      if (!rows.length) { nonce = String(Date.now()); shown = null; }
    }
    if (!shown) {
      const ranked = await rankedFeed(me, mode, nonce);
      shown = ranked.slice(0, PAGE_SIZE); hasMorePosts = ranked.length > PAGE_SIZE;
    }
    const posts = await decoratePosts(shown, me?._id);

    const [storyPeople, shareTargets, adConfig, feedAds] = await Promise.all([
      me ? getStoryPeople(me._id, 18) : getGuestStoryPeople(18),
      me ? getShareTargets(me._id, 30) : Promise.resolve([]),
      getAdConfig(),
      getAdsForPlacement('feed', me, 16)
    ]);
    const adSlots = planFeedAds({ count: posts.length, adConfig, feedAds, seed: `${me?._id || 'guest'}:${mode}:${nonce}:1` });

    res.set('Cache-Control', 'no-store');
    res.render('feed', {
      title: 'Lumi feed',
      posts, storyPeople, shareTargets, adConfig, adSlots,
      feedNonce: nonce,
      feedMode: mode,
      hasMorePosts,
      needsInterestOnboarding: !!me && !(me.interests || []).length,
      metaDescription: 'Lumi feed — For You algoritmi, following, yangi postlar va Smart Ad Delivery.'
    });
  } catch (err) { next(err); }
});

// Endless scroll: returns the next rendered page of the SAME ranked session.
router.get('/api/feed/page', async (req, res, next) => {
  try {
    const mode = modeOf(req.query.tab);
    const nonce = feedSession.cleanNonce(req.query.nonce);
    const page = Math.min(Math.ceil(DEPTH / PAGE_SIZE), Math.max(2, parseInt(req.query.page, 10) || 2));
    const adOffset = Math.min(60, Math.max(0, parseInt(req.query.ads, 10) || 0));
    if (!nonce) return res.status(400).json({ ok: false, error: 'nonce' });

    const me = req.currentUser ? await User.findById(req.currentUser._id).lean() : null;
    let ids = feedSession.get(me?._id, mode, nonce);
    if (!ids) ids = (await rankedFeed(me, mode, nonce)).map(p => String(p._id));   // restart/expiry: same nonce => same order

    const slice = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    res.set('Cache-Control', 'no-store');
    if (!slice.length) return res.json({ ok: true, html: '', hasMore: false, page });

    const posts = await decoratePosts(await hydrateFeedPosts(me, slice), me?._id);
    const [adConfig, feedAds] = await Promise.all([getAdConfig(), getAdsForPlacement('feed', me, 16)]);
    const adSlots = planFeedAds({ count: posts.length, adConfig, feedAds, offset: adOffset, seed: `${me?._id || 'guest'}:${mode}:${nonce}:${page}` });

    res.render('partials/feedposts', { posts, adConfig, adSlots }, (err, html) => {
      if (err) return next(err);
      res.json({ ok: true, html, hasMore: page * PAGE_SIZE < ids.length, page, count: posts.length });
    });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.PAGE_SIZE = PAGE_SIZE;
