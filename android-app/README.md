# Lumi Android

Google Play package: `uz.hallaym.lumi`

- Version: 1.0.1 (2)
- minSdk: 26 (Android 8.0)
- targetSdk / compileSdk: 36 (Android 16)
- Production URL: https://lumi-6yqp.onrender.com

Play hardening in v1.0.1: camera-only sensitive permission, prominent camera disclosure, third-party cookies disabled, Safe Browsing enabled, native Android share bridge, external links kept outside the WebView, cleartext disabled, backups disabled, public privacy/terms/account-deletion flows on the server, and third-party network ads suppressed in the Android shell.

The CI workflow intentionally produces unsigned APK/AAB artifacts. Sign them with the private upload key outside the public repository before Play Console upload.
