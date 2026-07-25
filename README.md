<div align="center">
  <img src="DATA GAME/assets/logo.png" alt="Rimba Tycoon 3D logo" width="220" />

  # Rimba Tycoon 3D

  Game tycoon tebang-pohon & tambang 3D berbasis browser, dibungkus jadi aplikasi Android.
</div>

## Tentang

**Rimba Tycoon 3D** (Penebang Pohon 3D) adalah game tycoon santai: tebang pohon,
tambang emas & batu bara, jual hasilnya di toko, lalu upgrade peralatan buat kerja
makin efisien. Dibangun full 3D di browser pakai Three.js — situs statis murni,
tanpa server/backend, bisa dimainkan offline, dan dibungkus jadi APK Android lewat
WebView.

- **Dikembangkan oleh:** [rynnn10](https://github.com/rynnn10)
- **Dibangun:** Juli 2026
- **Versi saat ini:** lihat footer di dalam game / `GAME_VERSION` di `DATA GAME/game.js`

## Fitur

**Gameplay inti**
- Tebang 3 jenis pohon (kecil/sedang/besar) pakai kapak — 2 level upgrade.
- Tambang emas & batu bara pakai pickaxe (alat terpisah dari kapak, wajib dibeli
  dulu di toko) — 2 level upgrade.
- Alat harus cocok sama target: kapak buat pohon, pickaxe buat batu tambang.
  Ganti alat lewat tombol ganti-senjata manual.
- Sistem stamina — lari, lompat, nebang, dan nambang menguras stamina; tidur di
  rumah buat memulihkannya.
- Jual kayu/emas/batu bara di Toko Desa buat dapat koin.
- Pohon & batu tambang langka (~8% kemunculan) dengan kilau dan hadiah 3x lipat.

**Progres & konten**
- **Papan Misi** — selesaikan misi (kumpulkan kayu/emas/batu bara/koin, dengan
  progres "5/10") buat membuka level berikutnya.
- **4 level/tema map**: Hutan, Kuburan, Bajak Laut, dan Pasar — lingkungan
  berubah tapi progres (koin, level alat, stamina) tetap kebawa semua.
- Bonus main harian & pencapaian (achievement) berdasarkan total koin yang
  pernah dikumpulkan.
- 6 pilihan karakter (Penjaga Hutan, Tengkorak, Zombie, Vampir, Hantu, Karyawan
  Toko) — bisa dipilih bebas dari menu utama.
- NPC karyawan toko dengan obrolan acak (beberapa skrip berbeda tiap ditemui).
- Siklus siang/malam mengikuti jam asli perangkat.

**Peta & navigasi**
- Minimap + peta wilayah besar (bisa digeser).
- Ketuk peta besar buat naruh pin penanda custom — muncul juga di minimap kecil.
- Sembunyi di rumput tinggi (efek transparansi).

**Lainnya**
- Bisa dimainkan **offline** (service worker + bisa di-install sebagai PWA).
- Dibungkus jadi **APK Android** asli (WebView + jembatan native buat tombol
  kembali/keluar aplikasi).

## Kontrol

| Kontrol | Fungsi |
|---|---|
| Joystick (sentuh) / tombol panah | Gerak |
| Tombol lari | Lari (pakai stamina) |
| Tombol lompat | Lompat (bisa lompati batu) |
| Tombol aksi (bulat, ikon ikut alat) | Tebang pohon / tambang batu / buka toko / buka papan misi |
| Tombol tidur (dekat rumah) | Pulihkan stamina |
| Minimap (ketuk) | Buka peta wilayah besar |
| Peta besar (ketuk) | Taruh pin penanda |

## Teknologi

- **Three.js r128** (`three.min.js` + `GLTFLoader.js`, build non-module lawas) — rendering 3D
- **Tailwind CSS** (CDN) — semua styling UI
- **Font Awesome 6** — ikon
- Vanilla JavaScript — tanpa framework, tanpa build step
- **Android**: Kotlin + WebView (`androidx.webkit`) buat bungkus jadi APK

Model 3D karakter dari [Mixamo](https://www.mixamo.com), model kapak & pohon dari
Sketchfab, dan aset tema level (kuburan/bajak laut/pasar) dari
[Kenney.nl](https://kenney.nl).

## Struktur Proyek

```
DATA GAME/       # Game-nya sendiri - situs statis, gak perlu build/install
  index.html     # Semua layar/modal (mulai, HUD, toko, papan misi, dst)
  game.js        # Seluruh logic game
  style.css      # Semua styling
  assets/        # Model 3D (.glb) & gambar
  sfx/           # Efek suara

android-app/     # Pembungkus APK Android (WebView) buat DATA GAME/
  app/           # Project Android (Kotlin)
  sync-web.ps1   # Sinkron DATA GAME/ -> aset Android (WAJIB dijalankan sebelum build APK)
  run.ps1        # Build + install + jalankan APK langsung ke HP terhubung
```

## Menjalankan di Browser

Tidak butuh build/install apa pun - cukup server statis:

```
cd "DATA GAME"
npx serve .
```

(Harus lewat `http://`, bukan buka file langsung - service worker & fetch butuh itu.)

## Build APK Android

```
cd android-app
./sync-web.ps1        # sinkron DATA GAME/ -> assets Android (WAJIB tiap DATA GAME berubah)
./gradlew.bat assembleDebug
```

APK debug hasilnya ada di `android-app/app/build/outputs/apk/debug/`. Atau pakai
`run.ps1` buat build + install + jalankan otomatis ke HP yang tersambung ADB.
