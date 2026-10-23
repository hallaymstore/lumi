'use strict';
/* Decides where sponsored cards go inside one rendered feed page (pure, unit-tested).
   Page 1 and every lazily loaded page use the same smart-delivery rules from buildFeedAdPositions. */
const { buildFeedAdPositions } = require('./ads');

/**
 * @returns {{after:number, ad?:object, network?:boolean}[]}  `after` = 1-based post index the card follows.
 */
function planFeedAds({ count, adConfig, feedAds = [], seed = '', offset = 0, pageSize = 50 }) {
  if (!adConfig?.enabled || !count) return [];
  const perPage = Math.max(1, Math.ceil(Number(adConfig.maxAdsPerPage || 6) * count / pageSize));
  const positions = buildFeedAdPositions(count, { ...adConfig, maxAdsPerPage: perPage }, seed);
  const out = [];
  let slot = Math.max(0, Number(offset) || 0);
  for (const after of positions) {
    const ad = feedAds[slot];
    if (ad) out.push({ after, ad });
    else if (adConfig.networkEnabled) out.push({ after, network: true });
    else continue;
    slot++;
  }
  return out;
}
module.exports = { planFeedAds };
