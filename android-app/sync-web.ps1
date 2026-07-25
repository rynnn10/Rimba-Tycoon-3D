<#
.SYNOPSIS
  Sinkronkan game web (DATA GAME) ke folder assets Android, lalu terapkan
  penyesuaian khusus offline (script/CSS pakai vendor/ lokal, bukan CDN;
  hapus registrasi Service Worker karena percuma di dalam APK).
  Versi: v1.0.0 | Update terakhir: Jumat, 24/07/2026 14:00 WIB
.DESCRIPTION
  Jalankan ini SETIAP KALI selesai edit game.js / index.html / style.css / assets
  di folder "DATA GAME", sebelum build APK (run.ps1). Tanpa ini, APK akan
  memuat versi lama dan perubahan kamu tidak akan muncul di HP.
.EXAMPLE
  .\sync-web.ps1
#>

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "DATA GAME"
$dst = Join-Path $PSScriptRoot "app\src\main\assets\www"

Write-Host "Sinkron dari: $src" -ForegroundColor Cyan
Write-Host "Ke Android:  $dst" -ForegroundColor Cyan

Copy-Item (Join-Path $src "game.js") (Join-Path $dst "game.js") -Force
Copy-Item (Join-Path $src "style.css") (Join-Path $dst "style.css") -Force
Copy-Item (Join-Path $src "index.html") (Join-Path $dst "index.html") -Force
Copy-Item (Join-Path $src "assets\*") (Join-Path $dst "assets") -Recurse -Force
Copy-Item (Join-Path $src "sfx\*") (Join-Path $dst "sfx") -Force

# --- Terapkan penyesuaian khusus Android ke index.html hasil copy ---
$htmlPath = Join-Path $dst "index.html"
$html = Get-Content $htmlPath -Raw
$html = $html -replace "`r`n", "`n" # normalize biar literal block-replace di bawah ini gak meleset gara-gara CRLF vs LF

$cdnBlock = @"
    <link rel="manifest" href="manifest.json" />
    <link rel="apple-touch-icon" href="assets/logo.png" />
    <link rel="icon" type="image/png" href="assets/logo.png" />

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    />
"@.Replace("`r`n", "`n")

$vendorBlock = @"
    <link rel="apple-touch-icon" href="assets/logo.png" />
    <link rel="icon" type="image/png" href="assets/logo.png" />

    <!-- Android build: dulu CDN, sekarang file lokal di vendor/ biar main tanpa internet -->
    <script src="vendor/tailwind.js"></script>
    <script src="vendor/three.min.js"></script>
    <script src="vendor/GLTFLoader.js"></script>
    <link rel="stylesheet" href="vendor/css/all.min.css" />
"@.Replace("`r`n", "`n")

$swBlock = @"
    <script src="game.js"></script>
    <script>
      // Register Service Worker for PWA
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("./sw.js")
            .then((reg) => console.log("SW Registered!", reg))
            .catch((err) => console.log("SW Failed", err));
        });
      }
    </script>
"@.Replace("`r`n", "`n")

$html = $html.Replace($cdnBlock, $vendorBlock)
$html = $html.Replace($swBlock, '    <script src="game.js"></script>')

$stamp = Get-Date -Format "dddd, dd/MM/yyyy HH:mm"
# index.html selalu di-copy ULANG dari source tiap run (tidak pernah punya header ini),
# jadi cukup tempel sekali di depan - tidak perlu cek/replace header lama.
$header = "<!-- Rimba Tycoon 3D - build Android (offline, vendor lokal) -->`n<!-- Auto-sync: $stamp WIB (jangan edit index.html ini manual, edit yang di DATA GAME lalu jalankan sync-web.ps1 lagi) -->`n"
$html = $header + $html

# Tulis tanpa BOM (Set-Content -Encoding utf8 di Windows PowerShell 5.1 selalu nambah BOM)
[System.IO.File]::WriteAllText($htmlPath, $html, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Sinkron selesai." -ForegroundColor Green
Write-Host "Ingat: naikkan versionName di app\build.gradle.kts manual, lalu build ulang (.\run.ps1)." -ForegroundColor Yellow
