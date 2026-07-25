// Rimba Tycoon 3D — App Android (WebView shell, main offline) — v1.4.1
// Update terakhir: Jumat, 24/07/2026 15:30 WIB
// v1.0.0: rilis pertama. WebView load game dari assets/www lokal (three.js/tailwind/font-awesome
//   ikut dibundle di www/vendor, bukan CDN) — main tanpa internet dari awal.
// v1.0.1 (kecil): fix "gagal memuat aset" di HP — three.js muat .glb/.mp3 pakai XMLHttpRequest,
//   dan Android blokir XHR antar-file kalau halaman dibuka dari file:///android_asset/ (setting
//   allowFileAccessFromFileURLs sudah tak berlaku lagi sejak targetSdk 30+). Ganti: serve assets/www
//   lewat WebViewAssetLoader (domain virtual https://appassets.androidplatform.net/), bukan file://.
// v1.3.0 (menengah): tombol back HP gak lagi navigasi WebView history / langsung keluar app -
//   sekarang panggil window.onAndroidBack() di JS, yang munculin modal konfirmasi (tema sama
//   spt modal lain di game) sebelum balik ke menu / keluar app.
// v1.4.1 (kecil): fix tombol "Keluar Game" cuma nampilin blank putih, app gak beneran ketutup -
//   window.close()/about:blank di JS gak bisa nutup Activity Android beneran (WebView emang gak
//   punya API buat itu). Tambah AndroidBridge.exitApp() (JS interface -> finishAffinity()),
//   dipanggil dari exitApp() di game.js kalau tersedia.
package com.rimba.tycoon

import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }
            }
            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
            loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        }
        setContentView(webView)
        hideSystemBars()
    }

    // Jembatan JS -> native. exitApp() JS-side (game.js) manggil AndroidBridge.exitApp()
    // buat beneran nutup app - window.close() dari JS gak bisa nutup Activity Android.
    private inner class AndroidBridge {
        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finishAffinity() }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // Sembunyikan status bar & navigation bar biar layar penuh, cocok buat game.
    private fun hideSystemBars() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
    }

    // Serahkan tombol back ke JS (window.onAndroidBack di game.js) - biar munculin
    // modal konfirmasi bertema sama spt modal lain, bukan langsung tutup app/navigasi WebView.
    override fun onBackPressed() {
        webView.evaluateJavascript("window.onAndroidBack && window.onAndroidBack();", null)
    }
}
