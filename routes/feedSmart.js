const router = require('express').Router();
const User = require('../models/User');
const { buildFeed } = require('../services/feed');
const { getStoryPeople, getGuestStoryPeople, getShareTargets } = require('../utils/socialUi');
const { decoratePosts } = require('../utils/socialState');
const { getAdConfig, getAdsForPlacement, buildFeedAdPositions } = require('../services/ads');

// Mounted before routes/social.js so this production feed route owns Smart Ad Delivery.
router.get('/feed', async (req, res) => {
  const mode = ['foryou', 'following', 'new'].includes(req.query.tab) ? req.query.tab : 'foryou';
  const me = req.currentUser ? await User.findById(req.currentUser._id).lean() : null;
  const nonce = req.query.refresh || Date.now();

  let posts = await buildFeed(me, { mode, limit: 50, nonce });
  posts = await decoratePosts(posts, me?._id);

  const [storyPeople, shareTargets, adConfig, feedAds] = await Promise.all([
    me ? getStoryPeople(me._id, 18) : getGuestStoryPeople(18),
    me ? getShareTargets(me._id, 30) : Promise.resolve([]),
    getAdConfig(),
    getAdsForPlacement('feed', me, 16)
  ]);

  const adPositions = buildFeedAdPositions(
    posts.length,
    adConfig,
    `${me?._id || 'guest'}:${mode}:${nonce}`
  );

  res.set('Cache-Control', 'no-store');
  res.render('feed', {
    title: 'Lumi feed',
    posts,
    storyPeople,
    shareTargets,
    adConfig,
    feedAds,
    adPositions,
    feedNonce: nonce,
    feedMode: mode,
    metaDescription: 'Lumi feed — For You algoritmi, following, yangi postlar va Smart Ad Delivery.'
  });
});

module.exports = router;
