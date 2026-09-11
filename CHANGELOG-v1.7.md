# Lumi v1.7 — Monetization Center

- Native sponsored posts inside Feed with configurable post interval.
- Compact banner ads on Explore, profiles, chat list and chat threads.
- Dedicated post-page advertising placement.
- CTA unlocks only after the ad stays at least 55% visible for the configured delay (3 seconds by default).
- Server-side impression, click and dismissal events with 30-minute duplicate billing protection.
- CPM and CPC revenue calculation, budget limits, CTR and seven-day activity reporting.
- Admin campaign create/edit/pause/end controls with R2 image uploads.
- Audience, schedule, placement, priority and global delivery controls.
- Every paid placement remains visibly labelled as advertising.
- Existing non-intrusive Adsterra banner zones from the owner's Reward Arena are used as a fallback when no direct campaign is available.
- Network banners run in isolated sandboxed iframes; popunder and Social Bar scripts are intentionally not injected into Lumi.

## Admin

Open `/admin/ads` while signed in as an administrator. Create at least one active campaign, upload its artwork, select placements and configure CPM/CPC pricing.

## Revenue meaning

The dashboard shows contracted/direct-ad revenue calculated from the price entered by the administrator. It is not a third-party ad-network payout statement. Third-party network zone IDs can be integrated separately once the provider account and approved site/domain are available.
