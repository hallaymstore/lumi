# Lumi — Google Play submission checklist

Package: `uz.hallaym.lumi`
Target API: 36 (Android 16)
Minimum API: 26 (Android 8)
Target audience: **18 and over only**
Contains ads: **Yes** (clearly labeled Lumi internal campaigns; third-party network slots are disabled in the Android app shell)

## Public URLs
- Privacy policy: `https://lumi-6yqp.onrender.com/privacy`
- Terms of Use / UGC rules: `https://lumi-6yqp.onrender.com/terms`
- Account deletion: `https://lumi-6yqp.onrender.com/account-deletion`

## App access
Guest feed is publicly viewable. Login is required for posting, comments, likes, saves, chat and settings. For review of authenticated features, provide Google with a working reviewer account in Play Console > App access.

## Data Safety — conservative declaration guide
Declare only what is actually used in the production build and keep this synchronized with the privacy policy.

Collected data likely includes:
- Personal info: name, phone number, user ID/username, optional profile information.
- Messages: direct messages and user chat content.
- Photos and videos: user uploads and camera photos initiated by the user.
- Files/docs: optional chat file uploads when used.
- App activity: views, likes, comments, saves, shares, dwell time and other interactions used for functionality/personalization/analytics.
- Device or other IDs / technical data: session identifiers, hashed security identifiers, user-agent and timestamps.

Not requested by Lumi Android: precise location, contacts, health, financial data, SMS/call logs.

Purposes: app functionality, account management, personalization, analytics, fraud/security and developer communications where applicable.

Security: data in transit uses HTTPS; passwords are hashed; MongoDB/R2 credentials remain server-side; users can request deletion in-app and on the public deletion page.

## UGC
- Terms acceptance is mandatory before UGC use.
- App is 18+.
- Reporting exists for objectionable content/users.
- Blocking exists for 1:1/social interaction.
- Admin moderation remains required operationally; reports must be reviewed and acted on promptly.

## Ads
Android Play build intentionally does not render Adsterra network iframe placements. Internal sponsored campaigns remain clearly labeled. Any future ad SDK/network must be reviewed for Google Play Ads, Data Safety, target-audience and content-rating compliance before release.

## Before production release
1. Complete Data Safety with the deployed build behavior.
2. Add the public Privacy Policy URL.
3. Add the Account deletion URL.
4. Mark Contains ads = Yes.
5. Complete content rating accurately for social/UGC/chat.
6. Set target audience to 18+ only.
7. Provide reviewer account/instructions for authenticated features.
8. Complete required closed testing for the developer account if Play Console requests it.
9. Use Play App Signing and preserve the private upload key.
10. Replace any credentials that have ever been committed to a public repository.
