'use strict';
/* Lumi feed ranking v2 — pure functions (no database access), fully unit-tested.
 *
 * Pipeline:  score  ->  arrange.
 *  - score():   engagement quality + freshness + personal affinity (follows, creators, tags, repeats).
 *  - arrange(): greedy re-ordering so the feed feels alive instead of "highest score first":
 *      * the same creator never appears twice inside a rolling window,
 *      * no long runs of the same topic or of followed creators only,
 *      * every 5th slot is an *exploration* slot for fresh, low-exposure content from creators the
 *        viewer does not follow yet (cold-start fairness, keeps the feed from becoming an echo chamber).
 */

// Explicit actions are intentionally much stronger than passive impressions.
const W = { impression: -0.08, view: 0.35, dwell: 0.018, like: 4.5, unlike: -3.5, comment: 6.5, save: 8, unsave: -5, share: 9, open_comments: 2.4, profile_visit: 3.2, not_interested: -30, hide_author: -60, clip_watch: 0.44, clip_skip: -8, clip_complete: 11 };

const id = v => String(v?._id || v || '');
const ageHours = (d, now = Date.now()) => Math.max(0, (now - new Date(d).getTime()) / 36e5);

function engagementQuality(p) {
  const l = Math.max(Number(p.likeCount || 0), p.likes?.length || 0);
  const c = Math.max(Number(p.commentCount || 0), p.comments?.length || 0);
  const s = Number(p.saveCount || 0), sh = Number(p.shareCount || 0), v = Math.max(1, Number(p.viewCount || 0));
  const weighted = l * 3 + c * 5 + s * 7 + sh * 9;
  const rate = Math.min(4, weighted / Math.max(25, v));
  return Math.log1p(weighted + Math.sqrt(v)) * 1.15 + rate * 1.8;
}
const freshness = h => 8 * Math.exp(-h / 48) + 2.5 * Math.exp(-h / (24 * 21)) + 0.8 * Math.exp(-h / (24 * 120));

function seededNoise(key, nonce) {
  let h = 2166136261;
  for (const ch of String(key) + String(nonce)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** Score one post for one viewer. `sig` is the output of userSignals() (or an empty object for guests). */
function scorePost(p, sig = {}, { mode = 'foryou', uid = '', nonce = 0, now = Date.now(), personalised = false } = {}) {
  const aid = id(p.author), pid = id(p._id), h = ageHours(p.createdAt, now);
  let score = engagementQuality(p) + freshness(h) + seededNoise(pid, nonce) * 3.6;
  // Evergreen quality bonus: old high-value posts can still rank, but not dominate.
  if (h > 24 * 30) score += Math.min(5, Math.max(0, Number(p.qualityScore || 0)) / 15);
  // Small, temporary lift for brand-new creators so they get a first audience.
  if (h < 72 && Number(p.author?.followerCount || 0) < 100) score += 1.4;
  if (mode === 'foryou' && personalised) {
    if (sig.following?.has(aid)) score += 8.5;
    if (aid === uid) score -= 3;
    score += Math.max(-14, Math.min(20, (sig.authorAffinity?.get(aid) || 0) * .45));
    let tag = 0; for (const raw of p.tags || []) tag += sig.tagAffinity?.get(String(raw || '').toLowerCase()) || 0;
    score += Math.max(-9, Math.min(14, tag * .27));
    const seen = sig.seen?.get(pid);
    if (seen) { const days = (now - new Date(seen.at).getTime()) / 864e5; if (days < .15) score -= 18; else if (days < 1) score -= 12; else if (days < 3) score -= 7; else if (days < 7) score -= 3; }
    if (sig.liked?.has(pid)) score -= 2.5;
    if (sig.saved?.has(pid)) score -= 1;
  }
  return score;
}

/** Is this a candidate for the exploration slots? (unfollowed, young or low-exposure, not seen before) */
function isExploration(p, sig = {}, now = Date.now()) {
  const aid = id(p.author), pid = id(p._id);
  if (sig.following?.has(aid) || sig.seen?.has(pid)) return false;
  if ((sig.authorAffinity?.get(aid) || 0) > 6) return false;
  return Number(p.viewCount || 0) < 250 && ageHours(p.createdAt, now) < 24 * 10;
}

/**
 * Greedy arrangement of already-scored posts (each has _feedScore). Returns at most `limit` posts.
 * `scored` must be sorted by _feedScore descending.
 */
function arrange(scored, { limit = 50, sig = {}, mode = 'foryou', now = Date.now() } = {}) {
  const pool = scored.slice();
  const out = [];
  const authors = [];            // author id per output position
  const tops = [];               // primary tag per output position
  const follows = [];            // followed-or-not per output position
  const personalised = mode === 'foryou';
  const AUTHOR_WINDOW = 4, LOOKAHEAD = 48;

  const okAt = p => {
    const a = id(p.author);
    if (authors.slice(-AUTHOR_WINDOW).includes(a)) return false;
    if (personalised) {
      const t = (p.tags && p.tags[0]) ? String(p.tags[0]).toLowerCase() : '';
      if (t && tops.length >= 2 && tops[tops.length - 1] === t && tops[tops.length - 2] === t) return false;
      if (sig.following?.has(a) && follows.length >= 3 && follows.slice(-3).every(Boolean)) return false;
    }
    return true;
  };
  const take = idx => {
    const [p] = pool.splice(idx, 1);
    authors.push(id(p.author));
    tops.push((p.tags && p.tags[0]) ? String(p.tags[0]).toLowerCase() : '');
    follows.push(!!sig.following?.has(id(p.author)));
    out.push(p);
  };

  while (out.length < limit && pool.length) {
    const wantExplore = personalised && (out.length + 1) % 5 === 0;
    let pick = -1;
    const span = Math.min(pool.length, wantExplore ? LOOKAHEAD * 4 : LOOKAHEAD);
    if (wantExplore) {
      for (let i = 0; i < span; i++) { if (isExploration(pool[i], sig, now) && okAt(pool[i])) { pick = i; break; } }
    }
    if (pick < 0) { for (let i = 0; i < span; i++) { if (okAt(pool[i])) { pick = i; break; } } }
    if (pick < 0) pick = 0;      // constraints cannot be met any more: never starve the feed
    take(pick);
  }
  return out;
}

module.exports = { W, engagementQuality, freshness, seededNoise, scorePost, isExploration, arrange, ageHours };
