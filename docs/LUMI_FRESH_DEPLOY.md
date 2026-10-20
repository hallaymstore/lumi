# LUMI Fresh: 100k-audience startup release plan (20 Oct 2026)

## Feature policy
- New published posts: 24 hours (`FRESH_POSTS_ENABLED=true`).
- New chat messages: 48 hours (`FRESH_MESSAGES_ENABLED=true`).
- Existing posts/messages **do not change** until operator runs an explicit audited migration.
- Expired records are excluded from queries immediately. Worker scans every 5 minutes in small batches and deletes Cloudflare R2 media before MongoDB records. Deletion can lag under outages or large backlogs.
- Story presence already expires after 24 hours. Optional `FRESH_STORY_PURGE_ENABLED=true` removes non-highlight Story media after a 7-day grace. Highlights intentionally remain (user-pinned).
- Drafts, account profiles, chat participants, security/moderation evidence and legally mandated payout records have separate retention requirements. Never TTL payment records.
- R2 public media links may remain browser/CDN-cached for their advertised cache lifetime; social page links are denied once expired. For genuinely private media, use authenticated/signed URLs.

## Activation (requires backups and legal review)
1. Back up MongoDB Atlas and R2 bucket. **Verify restore** on staging.
2. Test in a staging environment using an isolated DB and R2 bucket.
3. Run `npm ci && npm run check && node --test test/fresh-retention.test.js`.
4. Staging: set `FRESH_POSTS_ENABLED=true`, `FRESH_MESSAGES_ENABLED=true`,
   `FRESH_STORY_PURGE_ENABLED=true`, `FRESH_STORY_PURGE_DAYS=7`,
   `FRESH_CLEANUP_MINUTES=5`, `FRESH_CLEANUP_BATCH=40`.
5. Validate at least two users: make post, send text/image/voice chat, upload Story, follow, search, share, pin, and review after expiration. To shorten testing, use **staging DB** with hand-set expiresAt values instead of changing production clocks.
6. Announce new time-limited behavior in UI and policy. Existing users must accept the updated terms.
7. Deploy and watch logs `Lumi Fresh cleanup`, R2 deletions, CPU, memory, Mongo storage, DB query response time, Redis/SSE and request latency.
8. If approved, dry-run old data counts: `npm run fresh:migrate -- --include-messages --include-posts`.
9. Only AFTER verified backup and written approval, apply: `CONFIRM_FRESH_RETENTION_MIGRATION=YES npm run fresh:migrate -- --apply --include-messages --include-posts`. Existing media older than the retention period becomes due for deletion; this is irreversible, and **the migration does not itself delete the media**.
10. Process backlog with the cleanup worker and observe deletion rate before increasing `FRESH_CLEANUP_BATCH`. Run no destructive migration against production by default.

## Practical 100k-registered-user architecture
- Node/Express frontend/app: Render web service, scalable horizontally behind load balancer; measure p95 latency and CPU. A total of 100,000 registered accounts is not the same as 100,000 concurrent visitors.
- MongoDB Atlas: production tier, automatic backup/PITR, correct indexes, separate database and least-privilege connection. Monitor query scans and document counts. Revisit existing 180-day FeedEvent TTL before significant traffic.
- R2 + CDN: media object store, separate bucket from server, strict file limits; video transcoding, thumbnails, rate limits, capacity and egress monitoring. Chat files must not be public for truly private messaging.
- Redis: use for realtime fan-out across replicas, rate-limiting/short-lived feed caching and worker coordination. Never store durable financial balances only in Redis.
- A durable background worker/cron can replace the in-process timer for high-traffic deployments. Use lease queries to avoid duplicate deletion on replicas.
- Monitor: signup conversion, real DAU/WAU (exclude synthetic test accounts), active creators, uploads/day, retention D1/D7, moderation backlog, 5xx errors, R2 bytes, Mongo GB, cleanup lag in hours.
- Load-test traffic gradually (100, 500, 1k, 2k concurrent sessions) and scale from measurements. Do not claim 100k simultaneous capacity until validated.

## Payouts / December 1 2026 candidate launch
- No withdrawal or revenue promises until provider, KYC/AML, payout limits, tax/legal compliance and fraud checks are implemented and tested.
- Separate immutable financial ledger and audit trail from temporary social content.
- Only measure *verified real engagement* for monetization, never seeded/synthetic accounts or artificial views.
- Feature flags allow social Fresh launch independently of financial rollout.

## Rollback
- Disable new expiration stamping by setting `FRESH_POSTS_ENABLED=false` and `FRESH_MESSAGES_ENABLED=false`. Existing expiries remain and continue to be cleaned by the worker.
- To preserve already stamped items, stop the Fresh worker *before* reverting and update their expiration metadata from a verified backup according to an approved restore plan. Do not silently extend content against user expectations.
- Keep `R2_ORPHAN_SCAN=true` only with monitoring; incremental batches avoid loading all DB media keys into RAM.
