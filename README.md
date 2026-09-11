# Lumi Social v1.6 — Production Social Core

Mobile-first visual social network built with **Node.js + Express + MongoDB + Cloudflare R2 + EJS**.

This version is an upgrade of v1.5 and keeps the compact Lumi UI while replacing the weak “latest posts only” feed with a personalized recommendation pipeline and adding the production features needed before deployment.

## Main features

### Feed / discovery
- **For You / Following / Yangi** feed tabs.
- Recommendation candidate pools mix: fresh posts, 90-day trending, all-time evergreen, random discovery and followed creators.
- Ranking signals: follow relationship, likes, comments, saves, shares, dwell time, comment opens, profile visits, tags, previous views and explicit “Qiziq emas”.
- Strong creator diversity so one account cannot fill the top of the feed.
- Re-tapping the active Feed icon forces a fresh recommendation mix.
- Private, blocked and muted creators are filtered from recommendation results.
- Search supports creator names, `@username`, captions and `#tags`.

### Posts
- 1–10 image/video carousel.
- Image resize + WebP + thumbnail optimization through Sharp before R2 upload.
- Like, comments, nested reply mention, comment likes, save, share, view count, pin, report and `@mention`.
- Permanent public URLs: `/p/:id`.
- Open Graph, Twitter Card, canonical URL and JSON-LD for external previews.
- Guest users can browse and generate unique views; interactive actions require sign-in.

### Stories
- Image/video stories, optional music, caption, emoji stickers, link, `@mention`, poll and audience controls.
- Audience: everyone / followers / Close Friends.
- Story likes, viewers, replies to 1:1 chat, realtime like updates.
- Story archive and Highlights.
- 24h active story lifecycle without deleting archived/highlight metadata prematurely.

### Chat
- 1:1 realtime chat; detail view intentionally has no bottom navbar.
- SSE realtime by default; **Redis Pub/Sub** is used automatically when `REDIS_URL` is configured, allowing multiple Node instances.
- Typing status, read state, reactions, reply, edit, delete-for-everyone, pin.
- Cursor-based history: latest 60 messages first, older messages loaded on demand.
- Image/video/audio/file upload and browser voice-message recording.
- Post sharing into existing chats.
- One-time camera media with 10-second viewing window and media cleanup.

### Accounts / safety
- Phone-number login/register.
- OTP-ready registration and password reset; Eskiz provider integration included.
- Secure admin bootstrap: public registration never grants admin just because a phone number matches.
- Private account + follow requests.
- Block / Mute / Restrict.
- Hidden-word and simple spam filtering for comments.
- Content/user/report moderation workflow and admin audit log.
- Active-session tracking and “log out other sessions” security control.

### Notifications / PWA
- Realtime in-app notifications and unread badges.
- Like/follow/story-like notifications are grouped instead of spamming individual rows.
- Web Push via VAPID when configured.
- Installable PWA, app shortcuts and OS Share Target.
- Offline shell; personalized HTML is not stored in the service-worker cache.

### Creator / admin
- Creator analytics: views, reach, engagement, saves, shares, follower growth, top posts and best activity hours.
- Admin Control Center: platform statistics, health state, users, roles, verification, suspension, top posts/creators, feed-event signals, reports, announcements and audit log.
- `/healthz` endpoint for deploy health checks.

## Existing v1.5 database upgrade

**Back up MongoDB first.** Then install dependencies and run the migration once:

```bash
npm install
npm run migrate:v16
```

The migration preserves old embedded likes/comments/follows while copying them to scalable collections (`PostLike`, `Comment`, `Follow`, `SavedPost`, `StoryLike`, `StoryView`). New v1.6 writes use the scalable collections.

## Local start

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows, copy `.env.example` and rename the copy to `.env`.

## Production deployment order

1. Set a long `SESSION_SECRET`, `VIEW_HASH_SALT`, `OTP_SECRET` and real `SITE_URL`.
2. Configure MongoDB and Cloudflare R2.
3. Set a strong `ADMIN_PASSWORD` (12+ chars), then run `npm run admin:bootstrap` once.
4. For public registration, set `OTP_REQUIRED=true` and configure Eskiz or another provider implementation.
5. Configure Redis when running more than one Node instance.
6. Generate VAPID keys if Web Push is required.
7. If upgrading a v1.5 database, run `npm run migrate:v16` once before opening traffic.
8. Start with `npm start`. Health check: `/healthz`.

See `DEPLOY.md` for the full checklist.

## Important environment variables

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=
SESSION_SECRET=
SITE_URL=https://your-domain.example
VIEW_HASH_SALT=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=https://cdn.example.com

ADMIN_PHONE=+998901234567
ADMIN_PASSWORD=USE_A_UNIQUE_12_PLUS_CHARACTER_PASSWORD
ADMIN_USERNAME=lumiadmin
ADMIN_NAME=Lumi Admin

OTP_REQUIRED=true
OTP_PROVIDER=eskiz
OTP_SECRET=
OTP_TTL_MINUTES=5
ESKIZ_TOKEN=
ESKIZ_FROM=4546

REDIS_URL=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com

MEDIA_CLEANUP_MINUTES=30
R2_ORPHAN_SCAN=true
```

## Notes

- PWA install, camera, microphone and Web Push require HTTPS in production. `localhost` is allowed for local development.
- `SITE_URL` must be the final HTTPS domain for correct Telegram/WhatsApp/X previews, canonical links and sitemap URLs.
- The R2 public URL must be reachable by external social-preview crawlers.
- Live streaming is intentionally left as the next phase; the single `+` create menu already reserves **Live** as “Tez orada”.
