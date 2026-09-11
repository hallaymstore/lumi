# Lumi v1.6 deploy checklist

## 1. Database
- Use a MongoDB Atlas/production cluster.
- Back up the v1.5 database before upgrading.
- Set `MONGODB_URI`.
- For an existing v1.5 database run once: `npm run migrate:v16`.

## 2. Cloudflare R2
Create/configure a bucket and set:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL`

The public URL must use HTTPS and must be visible to Telegram/WhatsApp/X preview bots.

## 3. Secrets
Use unique random values for:
- `SESSION_SECRET`
- `VIEW_HASH_SALT`
- `OTP_SECRET`

Do not commit the production `.env` file.

## 4. Admin
Set a unique admin phone and a strong 12+ character password. Run:

```bash
npm run admin:bootstrap
```

After confirming the account exists, you may remove `ADMIN_PASSWORD` from the runtime environment. Public registration does not grant admin rights.

## 5. Phone OTP
Before public launch use:

```env
OTP_REQUIRED=true
OTP_PROVIDER=eskiz
ESKIZ_TOKEN=...
```

The included provider is Eskiz. If another SMS vendor is used, replace the provider implementation in `services/otp.js`.

## 6. Realtime
One Node process works with SSE without Redis. For multiple Render instances/processes configure `REDIS_URL` so events propagate through Redis Pub/Sub.

## 7. Web Push
Generate VAPID keys, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.

## 8. Domain / SEO
Set the final HTTPS `SITE_URL`. Check:
- `/robots.txt`
- `/sitemap.xml`
- `/p/<post-id>` social previews
- `/healthz`

## 9. Render-style deploy
Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Health check path:

```text
/healthz
```

Use Node 20+.

## 10. Final smoke test
Test at least two accounts and one guest browser:
- guest feed and unique views
- phone register/login/OTP
- follow/private follow request
- For You/Following/Yangi feeds
- like/comment/save/share/mention
- carousel post upload
- story like/view/reply/poll/highlight
- 1:1 chat realtime + reaction + reply + voice/media
- one-time camera photo
- push notification
- report/admin moderation
- PWA install and share target
