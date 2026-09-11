# Lumi v1.6 — Production Social Core

## Feed algorithm
- Replaced latest-only behavior with a multi-pool personalized recommender.
- Added fresh, trending, evergreen, random-discovery and following candidate sources.
- Added dwell-time, open-comments, like/comment/save/share, profile affinity, tag affinity, viewed-content penalties and explicit not-interested signals.
- Added all-time evergreen resurfacing and author diversity.
- Feed icon re-tap now forces a new ranking nonce.

## Scalable MongoDB social graph
- Added PostLike, Comment, CommentLike, Follow, SavedPost, StoryLike, StoryView, FeedEvent, UserRelation, Report, LoginSession and PushSubscription collections.
- Added v1.5 → v1.6 migration script and counter rebuilding.

## Posts / media
- Added 1–10 media carousel.
- Added Sharp WebP optimization and thumbnails.
- Added safe file-type sniffing, media cleanup and R2 orphan cleanup.
- Added private-content checks to direct post URLs, view tracking, search and sitemap exposure.

## Stories
- Added image/video, music, stickers, links, poll, mentions, Close Friends/followers audience, archive and highlights.
- Added StoryLike / StoryView scalable storage and realtime like/reply behavior.

## Chat / realtime
- Fixed old-history bug: latest messages are now loaded first with cursor pagination.
- Added reply, edit, delete-for-everyone, pin, attachment upload and voice recording.
- Added Redis Pub/Sub optional multi-instance realtime while retaining lightweight SSE fallback.

## Auth / safety
- Added phone OTP architecture and Eskiz provider integration.
- Added password reset, session tracking and session invalidation.
- Admin is now created only through secure bootstrap configuration/script.
- Added private accounts, follow requests, Block/Mute/Restrict, hidden-word filtering and full report moderation.

## PWA / notifications / creator
- Added VAPID Web Push and grouped notifications.
- Added PWA Share Target, shortcuts and safe offline shell.
- Added Creator Analytics and expanded Admin Control Center.
- Added `/healthz` deploy health endpoint.
