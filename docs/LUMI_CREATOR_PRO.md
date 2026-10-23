# Lumi Pro va Creator Monetization (beta)

Release: 23 October 2026

## Pro
- Admin manually grants or revokes Pro for 30 or 90 days at /admin/creator-program.
- UI: Pro badge, Coral/Aurora/Onyx profile theme, HTTPS creator link and 90-day counters.
- Video upload from stream endpoint: Pro up to 150 MB, standard up to 80 MB; 20 MB for images. Existing legacy memory-buffer upload endpoints still have smaller caps.
- Pro is currently an **admin-granted beta**. Payment checkout, subscriptions, invoices and recurring billing are NOT implemented.

## Monetization application
- Apply at /creator/program. Manual admin review is available at /admin/creator-program.
- Requirements: non-synthetic organic account, verified phone, age 18+, 30 days account age, public non-suspended profile, 500 real followers, 10,000 qualified post views in the preceding 30 days, 5 published original posts in the preceding 30 days, no confirmed recent policy violations.
- Real followers exclude synthetic and managed profiles. Eligible views are new unique PostView events only from authenticated, phone-verified, non-synthetic/non-managed users, excluding self-views. Guests and virtual engagement DO NOT qualify.
- Metrics aggregate into CreatorMetricDaily so Fresh post deletion does not erase all eligibility history. **Only activity recorded after rollout is included**; old views are not automatically backfilled.
- Admin approval is an editorial eligibility decision ONLY. It does not activate revenue sharing, payouts, wallet balances or withdrawals. Do not promise earnings.
- All admin actions are audit-logged. Rejected applications may be resubmitted after 30 days, subject to eligibility.

## Before taking real payments
Implement provider agreements, verified financial ledger, tax and KYC/AML flows as applicable, fraud controls, payout lifecycle, dispute handling, age restrictions and the full creator terms. Audit and load-test all upload and eligibility paths.
