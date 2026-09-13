# Keep JavaScript bridge methods callable from WebView after R8 optimization.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve useful crash line information for Play Console deobfuscation.
-keepattributes SourceFile,LineNumberTable
