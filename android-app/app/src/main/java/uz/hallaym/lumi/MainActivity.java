package uz.hallaym.lumi;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://lumi-6yqp.onrender.com/feed";
    private static final String APP_HOST = "lumi-6yqp.onrender.com";
    private static final int FILE_CHOOSER_REQUEST = 7001;
    private static final int WEB_CAMERA_REQUEST = 7002;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutputUri;
    private PermissionRequest pendingWebPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);
        configureWebView();
        Uri incoming = getIntent() != null ? getIntent().getData() : null;
        webView.loadUrl(resolveIncomingUrl(incoming));
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " LumiAndroid/1.0.2");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.addJavascriptInterface(new AndroidBridge(), "LumiAndroid");
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setWebViewClient(new LumiWebViewClient());
        webView.setWebChromeClient(new LumiChromeClient());
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> openExternal(url));
    }

    private boolean isTrustedOrigin(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost());
    }

    private String resolveIncomingUrl(Uri uri) {
        if (uri == null) return HOME_URL;
        if (isTrustedOrigin(uri)) return uri.toString();
        if ("lumi".equalsIgnoreCase(uri.getScheme())) {
            String path = uri.getPath() == null || uri.getPath().isEmpty() ? "/feed" : uri.getPath();
            String query = uri.getEncodedQuery();
            return "https://" + APP_HOST + path + (query == null ? "" : "?" + query);
        }
        return HOME_URL;
    }

    private boolean handleUri(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        if ("lumi".equals(scheme)) {
            if ("reload".equalsIgnoreCase(host)) webView.reload();
            else webView.loadUrl(resolveIncomingUrl(uri));
            return true;
        }
        if ("https".equals(scheme) && APP_HOST.equals(host)) return false;
        if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
            openExternal(uri.toString());
            return true;
        }
        return true;
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (Exception ignored) { Toast.makeText(this, "Havolani ochib bo‘lmadi", Toast.LENGTH_SHORT).show(); }
    }

    private void showOffline() {
        String html = "<!doctype html><html><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                "<style>body{font-family:sans-serif;background:#fff7fb;color:#241820;display:grid;place-items:center;height:100vh;margin:0;padding:24px;box-sizing:border-box}.c{text-align:center;max-width:340px}h2{margin:8px 0}p{color:#7a6673;font-size:14px;line-height:1.5}button{border:0;border-radius:14px;padding:13px 20px;background:linear-gradient(135deg,#ff4f8b,#8c5cff);color:#fff;font-weight:700}</style>" +
                "<body><div class='c'><div style='font-size:48px'>✦</div><h2>Internet aloqasi yo‘q</h2><p>Lumi’ni davom ettirish uchun internetni tekshiring va qayta urinib ko‘ring.</p><button onclick=\"location.href='lumi://reload'\">Qayta urinish</button></div></body></html>";
        webView.loadDataWithBaseURL("https://" + APP_HOST, html, "text/html", "utf-8", null);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (intent != null && intent.getData() != null) webView.loadUrl(resolveIncomingUrl(intent.getData()));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data == null && cameraOutputUri != null) result = new Uri[]{cameraOutputUri};
            else result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        }
        fileCallback.onReceiveValue(result); fileCallback = null; cameraOutputUri = null;
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != WEB_CAMERA_REQUEST || pendingWebPermission == null) return;
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        else pendingWebPermission.deny();
        pendingWebPermission = null;
    }

    private void requestWebCamera(PermissionRequest request) {
        pendingWebPermission = request;
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); pendingWebPermission = null; return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Kamera ruxsati")
                .setMessage("Lumi kamerani faqat siz kamera funksiyasini ochganingizda surat olish uchun ishlatadi. Preview qurilmangizda ko‘rsatiladi; surat faqat siz yuborishni tanlaganingizdan keyin serverga uzatiladi.")
                .setPositiveButton("Davom etish", (d,w) -> requestPermissions(new String[]{Manifest.permission.CAMERA}, WEB_CAMERA_REQUEST))
                .setNegativeButton("Bekor qilish", (d,w) -> { request.deny(); pendingWebPermission = null; })
                .setOnCancelListener(d -> { request.deny(); pendingWebPermission = null; })
                .show();
    }

    private class LumiWebViewClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleUri(request.getUrl()); }
        @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.cancel(); Toast.makeText(MainActivity.this, "Xavfsiz SSL ulanishi amalga oshmadi", Toast.LENGTH_LONG).show(); }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { if (request.isForMainFrame()) showOffline(); }
    }

    private class LumiChromeClient extends WebChromeClient {
        @Override public void onProgressChanged(WebView view, int newProgress) { progressBar.setProgress(newProgress); progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE); }
        @Override public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                if (!isTrustedOrigin(request.getOrigin())) { request.deny(); return; }
                boolean video=false; for(String resource:request.getResources()) if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video=true;
                if (!video) { request.deny(); return; }
                requestWebCamera(request);
            });
        }
        @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (pendingWebPermission == request) pendingWebPermission = null; }
        @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null); fileCallback = filePathCallback;
            Intent content = new Intent(Intent.ACTION_GET_CONTENT); content.addCategory(Intent.CATEGORY_OPENABLE); content.setType(resolveMime(params.getAcceptTypes())); content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
            if (params.isCaptureEnabled() && resolveMime(params.getAcceptTypes()).startsWith("image/")) {
                Intent camera=buildCameraIntent(); if(camera!=null){startActivityForResult(camera,FILE_CHOOSER_REQUEST);return true;}
            }
            Intent chooser=Intent.createChooser(content,"Fayl tanlang"); Intent camera=buildCameraIntent(); if(camera!=null)chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera}); startActivityForResult(chooser,FILE_CHOOSER_REQUEST); return true;
        }
    }

    private class AndroidBridge {
        @JavascriptInterface public void share(String title, String text, String url) {
            runOnUiThread(() -> {
                try {
                    Intent send=new Intent(Intent.ACTION_SEND); send.setType("text/plain"); send.putExtra(Intent.EXTRA_SUBJECT,title); send.putExtra(Intent.EXTRA_TEXT,(text==null?"":text)+"\n"+(url==null?"":url)); startActivity(Intent.createChooser(send,"Ulashish"));
                } catch(Exception ignored){ Toast.makeText(MainActivity.this,"Ulashib bo‘lmadi",Toast.LENGTH_SHORT).show(); }
            });
        }
    }

    private String resolveMime(String[] acceptTypes) {
        if (acceptTypes==null||acceptTypes.length==0)return "*/*";
        for(String type:acceptTypes)if(type!=null&&!type.trim().isEmpty()&&!"*/*".equals(type))return type;
        return "*/*";
    }

    private Intent buildCameraIntent() {
        if (!getPackageManager().hasSystemFeature("android.hardware.camera.any")) return null;
        try {
            ContentValues values=new ContentValues(); values.put(MediaStore.Images.Media.DISPLAY_NAME,"lumi_"+System.currentTimeMillis()+".jpg"); values.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");
            cameraOutputUri=getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values); if(cameraOutputUri==null)return null;
            Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE); camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraOutputUri); camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION); return camera.resolveActivity(getPackageManager())==null?null:camera;
        } catch(Exception ignored){return null;}
    }
}
