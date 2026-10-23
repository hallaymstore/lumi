# Lumi Clips v1.13 — Video and design

## User features
- /clips: vertical 9:16 snapping feed, swipe and arrow up/down, native mobile-style controls.
- Mobile Clips tab, topbar shortcut, and create menu Clip shortcut.
- Players: play/pause, scrub, mute, captions, 1x/1.5x/2x speed, fullscreen and picture-in-picture (where supported).
- Visible-only muted autoplay, Data Saver and reduced-motion support. Each new Clip loads its source on demand; neighboring clips may be prefetched only when Data Saver is off.
- Post composer auto-generates a 360 x 640 WebP cover from a locally decoded video when possible. For videos the browser cannot decode, video uploads proceed without a poster.
- Optional SRT or VTT file is converted on server to sanitized WebVTT, max 32 KB. Subtitles are attached to the first video.
- Same-origin private/authorized caption proxy avoids cross-origin WebVTT loading problems.
- Post metadata and all keys (original media, poster, captions, optimized rendition) are cleaned when a Fresh post expires or is deleted.
- Former video posts still play; absent poster/captions fall back cleanly.

## Quality pipeline
- Upload is a bounded stream through Render to R2. It does not buffer the entire video in server RAM.
- Browser video uses preload=none to save bandwidth. Covers are a compressed WebP snapshot.
- Standard streamed upload: <=80 MB per video; Pro: <=150 MB. These are not promises of automatically produced multi-quality renditions.
- For genuine optional 720p MP4/H.264 optimization, run the separate FFmpeg CLI on a worker with enough CPU/RAM:
  node scripts/optimize-clip.js POST_ID
- Requires FFmpeg, MongoDB and Cloudflare R2 credentials on the worker. Output at most 720x1280, H.264 veryfast CRF27 maxrate1200k + AAC96k + faststart.
- Optimized version selected only if at least 5% smaller than source; original retained as fallback.
- No automatic queue/scheduler, no live FFmpeg on the existing 512MB Render web instance, and no multi-rendition HLS/ABR yet. To support 100k users add a worker queue and CDN playback variants.

## Validation
- npm run check
- npm run check:views
- node --test test/*.test.js
- Visit /clips in public browser and test private profile filtering; navigate to /posts/create?type=clip as authenticated user to upload a short MP4 and optional VTT.
- Run media cleanup tests for cover, caption and playback keys.
