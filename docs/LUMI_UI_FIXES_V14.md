# Lumi UI bug fixes v1.14

Scope: fix existing regressions before introducing more features.

1. Feed post menu native-looking buttons: replaced old details with accessible toggle, portal popover, fixed layout, Escape/outside click handling and keyboard focus.
2. Clips comments icon now opens the same in-page bottom sheet used in Feed, rather than navigating away. Reuses share sheet and supports guest read/authenticated commenting.
3. 9:16 clip stage now reserves real viewport space for navbar and video controls on mobile and desktop.
4. Opening comments/share/auth pauses clips; closing dialog restores playback if it had been playing; keyboard shortcuts disabled during overlays.
5. UI CSS loaded last, scoped to avoid collisions with legacy selectors.

Validation: npm run check; npm run check:views; node --test test/*.test.js; browser smoke tests /feed and /clips in desktop/mobile.
Authenticated commenting, submitting forms and moderation must be checked with a permitted test account.