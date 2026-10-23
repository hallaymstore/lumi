const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePost, arrange, isExploration, seededNoise } = require('../services/feedRank');
const { retentionScore, rankClips } = require('../services/clipRank');
const feedSession = require('../services/feedSession');
const { planFeedAds } = require('../services/feedAds');

const NOW = Date.parse('2026-10-23T12:00:00Z');
const hex = n => String(n).padStart(24, '0');
let seq = 0;
function post({ author, tags = [], hours = 5, likes = 0, views = 100, followers = 500 } = {}) {
  const i = ++seq;
  return { _id: hex(i), author: { _id: hex(author), followerCount: followers }, tags, createdAt: new Date(NOW - hours * 36e5), likeCount: likes, viewCount: views, commentCount: 0 };
}
const scoreAll = (posts, sig, opts = {}) => posts.map(p => ({ ...p, _feedScore: scorePost(p, sig, { now: NOW, nonce: 'n', personalised: true, ...opts }) })).sort((a, b) => b._feedScore - a._feedScore);
const emptySig = () => ({ following: new Set(), authorAffinity: new Map(), tagAffinity: new Map(), seen: new Map(), liked: new Set(), saved: new Set() });

test('seeded noise is deterministic per nonce and differs between nonces', () => {
  assert.equal(seededNoise('a', 'x'), seededNoise('a', 'x'));
  assert.notEqual(seededNoise('a', 'x'), seededNoise('a', 'y'));
});

test('followed creators and creator affinity outrank strangers, repeats are punished', () => {
  const a = post({ author: 1 }), b = post({ author: 2 });
  const sig = emptySig(); sig.following.add(hex(1)); sig.authorAffinity.set(hex(1), 10);
  assert.ok(scorePost(a, sig, { now: NOW, nonce: 1, personalised: true }) > scorePost(b, sig, { now: NOW, nonce: 1, personalised: true }) + 5);
  sig.seen.set(a._id, { at: new Date(NOW - 5 * 60_000) });
  assert.ok(scorePost(a, sig, { now: NOW, nonce: 1, personalised: true }) < scorePost(b, sig, { now: NOW, nonce: 1, personalised: true }));
});

test('arrange: same creator never repeats inside the rolling window', () => {
  const posts = [];
  for (let i = 0; i < 12; i++) posts.push(post({ author: 1, likes: 500 }));   // one prolific, very strong creator
  for (let i = 0; i < 12; i++) posts.push(post({ author: 10 + i, likes: 1 }));
  const out = arrange(scoreAll(posts, emptySig()), { limit: 20, sig: emptySig(), now: NOW });
  for (let i = 0; i < out.length; i++) {
    const a = String(out[i].author._id);
    assert.ok(!out.slice(Math.max(0, i - 4), i).some(x => String(x.author._id) === a) || i >= 12, 'creator repeated in window at ' + i);
  }
  assert.equal(out.length, 20);
});

test('arrange: no endless run of one topic or of followed creators', () => {
  const sig = emptySig(); const posts = [];
  for (let i = 0; i < 10; i++) { posts.push(post({ author: 100 + i, tags: ['football'], likes: 200 })); sig.following.add(hex(100 + i)); }
  for (let i = 0; i < 10; i++) posts.push(post({ author: 200 + i, tags: ['art'], likes: 5 }));
  // Only the first 14 slots are checked: after the 10 football posts are used up, only 'art' is left and a
  // run is unavoidable (the algorithm must never starve the feed instead of breaking the rule).
  const out = arrange(scoreAll(posts, sig), { limit: 20, sig, now: NOW }).slice(0, 14);
  let run = 0, maxRun = 0;
  for (const p of out) { run = sig.following.has(String(p.author._id)) ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  assert.ok(maxRun <= 3, 'followed run too long: ' + maxRun);
  let topic = 0, maxTopic = 0, last = '';
  for (const p of out) { topic = p.tags[0] === last ? topic + 1 : 1; last = p.tags[0]; maxTopic = Math.max(maxTopic, topic); }
  assert.ok(maxTopic <= 3, 'topic run too long: ' + maxTopic);
});

test('arrange: every 5th slot prefers fresh exploration content from unfollowed creators', () => {
  const sig = emptySig(); const posts = [];
  for (let i = 0; i < 15; i++) { posts.push(post({ author: 300 + i, likes: 400, views: 5000, hours: 24 * 40 })); sig.following.add(hex(300 + i)); }
  for (let i = 0; i < 5; i++) posts.push(post({ author: 400 + i, likes: 0, views: 10, hours: 3 }));
  const out = arrange(scoreAll(posts, sig), { limit: 15, sig, now: NOW });
  const slot5 = out[4], slot10 = out[9];
  assert.ok(isExploration(slot5, sig, NOW), 'slot 5 should be exploration');
  assert.ok(isExploration(slot10, sig, NOW), 'slot 10 should be exploration');
});

test('arrange never starves the feed when constraints cannot be met', () => {
  const posts = []; for (let i = 0; i < 8; i++) posts.push(post({ author: 1, tags: ['x'] }));
  const out = arrange(scoreAll(posts, emptySig()), { limit: 8, sig: emptySig(), now: NOW });
  assert.equal(out.length, 8);
});

test('clip retention: unknown = 0, proven completion boosts, mass skipping punishes, bounded', () => {
  assert.equal(retentionScore(null), 0);
  assert.ok(Math.abs(retentionScore({ complete: 0, skip: 0, watch: 0 })) < 1e-9);
  assert.ok(retentionScore({ complete: 70, skip: 5, watch: 25 }) > 6);
  assert.ok(retentionScore({ complete: 1, skip: 80, watch: 10 }) < -4);
  assert.ok(retentionScore({ complete: 1e6, skip: 0, watch: 0 }) <= 10);
  assert.ok(retentionScore({ complete: 0, skip: 1e6, watch: 0 }) >= -8);
});

test('rankClips uses community retention stats', () => {
  const mk = (id, author) => ({ _id: hex(id), author: { _id: hex(author) }, createdAt: new Date(NOW - 5 * 36e5), tags: [], likeCount: 0, commentCount: 0, viewCount: 100 });
  const rows = [mk(1, 1), mk(2, 2)];
  const stats = new Map([[hex(1), { complete: 1, skip: 90, watch: 9 }], [hex(2), { complete: 80, skip: 5, watch: 15 }]]);
  const out = rankClips(rows, { following: new Set(), seen: new Map() }, { limit: 2, now: NOW, stats });
  assert.equal(out[0]._id, hex(2));
});

test('feed session store: ids per viewer+mode+nonce, expiry-safe, nonce sanitising', () => {
  feedSession.clear();
  assert.equal(feedSession.cleanNonce('123-abc_X'), '123-abc_X');
  assert.equal(feedSession.cleanNonce('../etc/passwd'), '');
  assert.equal(feedSession.cleanNonce('x'.repeat(41)), '');
  feedSession.put('u1', 'foryou', 'n1', [hex(1), hex(2)]);
  assert.deepEqual(feedSession.get('u1', 'foryou', 'n1'), [hex(1), hex(2)]);
  assert.equal(feedSession.get('u2', 'foryou', 'n1'), null);
  assert.equal(feedSession.get('u1', 'new', 'n1'), null);
});

test('planFeedAds: proportional per page, continues ad offset, falls back to network slots', () => {
  const cfg = { enabled: true, maxAdsPerPage: 6, smartDelivery: true, firstAdMin: 5, firstAdMax: 6, gapMin: 4, gapMax: 7 };
  const ads = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
  const p1 = planFeedAds({ count: 12, adConfig: cfg, feedAds: ads, seed: 's' });
  assert.ok(p1.length >= 1 && p1.length <= 2);
  assert.equal(p1[0].ad._id, 'a');
  const p2 = planFeedAds({ count: 12, adConfig: cfg, feedAds: ads, seed: 's2', offset: 2 });
  assert.equal(p2[0].ad._id, 'c');
  const net = planFeedAds({ count: 12, adConfig: { ...cfg, networkEnabled: true }, feedAds: [], seed: 's3' });
  assert.ok(net.length >= 1 && net.every(x => x.network));
  assert.deepEqual(planFeedAds({ count: 12, adConfig: { ...cfg, enabled: false }, feedAds: ads }), []);
  assert.deepEqual(planFeedAds({ count: 12, adConfig: cfg, feedAds: [] }), []);
});
