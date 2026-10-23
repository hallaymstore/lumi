'use strict';
/* Community watch statistics for Clips (last 14 days), cached for 10 minutes per post.
   They answer "do people actually finish this video?" - the strongest quality signal for short video. */
const mongoose = require('mongoose');
const FeedEvent = require('../models/FeedEvent');

const TTL = 10 * 60_000, MAX = 6000, WINDOW_DAYS = 14;
const cache = new Map();
const empty = () => ({ complete: 0, skip: 0, watch: 0 });

async function clipStats(ids) {
  const out = new Map(), need = [], now = Date.now();
  for (const raw of ids || []) {
    const id = String(raw), hit = cache.get(id);
    if (hit && now - hit.at < TTL) out.set(id, hit.v); else if (/^[a-f0-9]{24}$/i.test(id)) need.push(id);
  }
  if (need.length) {
    const rows = await FeedEvent.aggregate([
      { $match: { post: { $in: need.map(x => new mongoose.Types.ObjectId(x)) }, type: { $in: ['clip_watch', 'clip_skip', 'clip_complete'] }, createdAt: { $gte: new Date(now - WINDOW_DAYS * 864e5) } } },
      { $group: { _id: { post: '$post', type: '$type' }, n: { $sum: 1 } } }
    ]).catch(() => []);
    const fresh = new Map(need.map(id => [id, empty()]));
    for (const r of rows) {
      const v = fresh.get(String(r._id.post)); if (!v) continue;
      if (r._id.type === 'clip_complete') v.complete = r.n; else if (r._id.type === 'clip_skip') v.skip = r.n; else v.watch = r.n;
    }
    for (const [id, v] of fresh) { cache.set(id, { at: now, v }); out.set(id, v); }
    while (cache.size > MAX) cache.delete(cache.keys().next().value);
  }
  return out;
}
module.exports = { clipStats };
