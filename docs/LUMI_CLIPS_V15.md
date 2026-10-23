# Lumi Clips v1.15 — autoplay, 30-second cap and For You

## Behavior
- Vertical 9:16 clips use muted autoplay when actually visible. iOS/mobile browser restrictions or OS Data Saver may still block autoplay; a tap-to-play fallback is shown.
- The portrait screen no longer shows `1/N` totals.
- Mobile topbar hides secondary controls; video seek/mute/captions stay visible, with rate/PiP/fullscreen under settings.
- Initial batch 8, next batches are loaded on-demand with no page navigation; cards are initialized using delegated Like/Comments/Share handlers.
- Each authenticated watch session sends a bounded single clip_watch, clip_skip or clip_complete event on swipe/page exit. Guest watchers are not profiled; view counts continue using normal PostView protections.
- Ranking mixes recent/trending/discovery video candidates, genuine follows, likes and save-derived author/tag affinities, recency, completion, skips, previously-seen penalties, private and blocked filters, creator diversity.
- Fresh videos can enter the discovery candidates without historical likes. FeedEvent has 180-day TTL.

## New upload policy
- NEW video uploads through post/clip create, draft and edit paths are limited to 30 seconds; this applies to standard and Pro users.
- On browser: reject duration over 30 seconds before upload. On server: verify actual MP4 mvhd/WebM Info duration after R2 upload (range read; limited RAM) and before issuing signed publish token.
- Server rejects unknown/unreadable duration to fail closed; client-uploaded duration cannot override server-signed value.
- Older published videos are retained as they were; no retroactive trimming or deletion.
- Story/chat file routes are unchanged by this post/clip limit.
- Some unusual containers with missing/unreachable metadata cannot be verified and must be remuxed into standard MP4/WebM. The container metadata check is not a full video-decoding forensic validation.

## Verification
- `npm run check` (Node JS syntax)
- `npm run check:views` (EJS rendering)
- `node --test test/*.test.js` (MP4/WebM duration/score and UI regression)
- Manual iOS and Android test of autoplay restrictions, 30.1s rejection, muted sound toggle, swipe recommendation loading and post/clip comments.
- Further scale: cache affinity / precompute video pools and metrics at high MAU. No ML infra required for basic content-based affinity scoring.