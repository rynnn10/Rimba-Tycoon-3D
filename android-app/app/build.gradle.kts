// App module — v2.2.0 (Sabtu, 25/07/2026 01:15 WIB)
// versionName dinaikkan tiap perubahan: patch=kecil, minor=menengah, major=besar.
// v2.2.0 (menengah): peta besar sekarang bisa DIKETUK buat naruh pin penanda custom
//   (muncul juga di minimap kecil, ada tombol "Hapus Pin"). Icon tombol aksi nebang/
//   nambang sekarang ikut ALAT YANG DIPEGANG (kapak/martil), bukan target pohon/batu
//   lagi - lebih jujur karena sekarang alat WAJIB cocok sama target. Batu bara/emas
//   gak dibedain lagi di icon tombol (balik jadi 1 icon martil pas pegang pickaxe,
//   dulu sempat dibedain warna gem/kubus). Papan Misi sekarang nampilin progres
//   angka ("5/10"), bukan cuma status selesai/belum. Batu tambang sekarang juga bisa
//   dilompati (sama kayak batu hiasan minggu lalu). Lompatan dikurangi lagi
//   (0.4 -> 0.32).
// v2.1.0 (menengah): titik lokasi Papan Misi (toko kedua) ditambah di minimap kecil
//   & peta besar (ungu). Alat sekarang WAJIB cocok - pohon cuma bisa ditebang pakai
//   kapak, batu tambang cuma bisa pakai pickaxe (dulu alat ganti OTOMATIS pas deket
//   target jadi syarat ini gak pernah kepakai - sekarang ganti alat cuma lewat
//   tombol manual, ganti-senjata beneran ada gunanya). Keterangan "Butuh Kapak!"/
//   "Butuh Pickaxe!" muncul di atas bar darah kalau alat gak cocok. Icon tombol lari
//   ganti jadi orang lari (fa-person-running, dulu icon angin). Batu hiasan sekarang
//   bisa dilompati (gak lagi jadi tembok solid pas lompat), tapi tetap solid kalau
//   jalan biasa. Icon tombol tambang dibedain emas (gem kuning) vs batu bara (kubus
//   abu-abu), dulu sama-sama icon gem polos.
// v2.0.0 (besar): sistem LEVEL/TEMA MAP baru - papan misi di toko kedua (dulu cuma
//   dekorasi, sekarang fungsional: selesaikan semua misi di 1 level buat buka level
//   berikutnya). Progress (koin/kapak/pickaxe/stamina) tetap kebawa semua antar level,
//   cuma lingkungan/tema map yang reskin: Level 1 Hutan (default), Level 2 Kuburan,
//   Level 3 Bajak Laut, Level 4 Pasar (aset dari kit Kenney yang sebelumnya nganggur
//   di project, di-tint warna flat lewat kode - bukan pakai texture asli kit-nya, biar
//   gak ribet ngurus colormap eksternal per kit). Tambah juga: obrolan NPC sekarang
//   acak dari beberapa skrip (dulu 1 skrip 3-baris diulang selamanya), bonus koin main
//   harian (sekali per hari nyata), pohon/batu tambang langka acak (~8%, kilau + reward
//   3x), toast pencapaian (achievement) di kelipatan total koin yang pernah didapat.
// v1.10.0 (menengah): tambah keterangan harga jual per 1 barang (kayu/emas/batu bara)
//   di toko, tambah label energi (⚡) di atas bar darah pohon/batu tambang (dulu cuma
//   ada bar-nya, gak keliatan biaya staminanya sebelum mukul), tambah tombol manual
//   ganti senjata (axe<->pickaxe, tetap butuh beli pickaxe dulu - auto-switch pas
//   deket pohon/batu tetap jalan seperti biasa, tombol ini buat pas lagi gak deket
//   keduanya). Titik emas di minimap diganti oranye (dulu kuning, mirip banget sama
//   titik toko). Icon animasi "kembali ke menu utama" ganti jadi rumah (dulu panah
//   kiri). Toast notifikasi dikecilkan lagi khusus mode HP.
// v1.9.0 (menengah): fix crash toko YANG BALIK LAGI - ternyata bug sama persis kayak
//   pickaxe (v1.8.1) juga ada di tombol upgrade KAPAK (span "upgrade-cost" kehapus
//   dari DOM begitu axe MAX, tapi openShop() masih akses tanpa cek null -> error ->
//   isPaused nyangkut true -> semua tombol/joystick beku total lagi). Tambah guard
//   isChopping di awal performChop()/performMine() (dulu bisa spam klik numpuk
//   animasi/damage kalau tombol aksi diklik cepat). showToast() sekarang hapus toast
//   sebelumnya dulu sebelum nampilin yang baru (dulu numpuk berantai ke bawah). Fix
//   toast "SIAP DIMAINKAN OFFLINE" nongol ulang tiap ganti alat (axe<->pickaxe) -
//   manager.onLoad Three.js kepanggil ulang tiap loader.load() baru, sekarang di-guard
//   sekali jalan. Fix karakter "gempa"/goyang pas nabrak batas bukit - dulu posisi
//   di-snap ulang tiap frame pakai sudut dari joystick (noise kecil x radius gede =
//   lompatan keliatan), sekarang cuma diam kayak nabrak batu biasa. Titik tambang
//   emas/batu bara ditambahin ke minimap kecil & peta besar. Icon tombol kapak ganti
//   jadi emoji 🪓 (PNG kapak.png keliatan pecah di tombol kecil, FontAwesome free gak
//   ada icon kapak asli). Ukuran elemen HUD/tombol/teks di mode HP dikecilkan dikit.
// v1.8.1 (kecil): fix crash toko - startGame() lupa reset gold/coal/pickaxeLevel/
//   pickaxeDamage jadi undefined (bikin HUD nampilin "Undefined" & HP batu tambang
//   NaN alias gak bisa pecah/"nyangkut"), fix openShop() lempar error kalau elemen
//   pickaxe-upgrade-cost udah kehapus dari DOM (pickaxe level MAX) - dulu gak dicek
//   null dulu, bikin isPaused nyangkut true & semua tombol/gerakan beku total sampai
//   app ditutup paksa. Tambah info "Koin Kamu" di modal toko.
// v1.8.0 (menengah): fix karakter/pohon/batu nembus batu bukit pembatas map (collision
//   radius dideketin ke tepi bukit + cap jarak spawn), kurangi lompatan lagi, cone arah
//   kamera jadi setengah lingkaran tumpul (dulu segitiga lancip) + ditambahin ke peta
//   besar juga (dulu cuma di minimap kecil), icon tombol pohon jadi gambar kapak asli,
//   PICKAXE jadi alat terpisah (wajib dibeli buat nambang, level/upgrade sendiri - kapak
//   sekarang max Lv.2 karena model "Lv.3"-nya ternyata pickaxe asli dari kit), toko kedua
//   ("general store") pakai gubuk + dekor rak/etalase/freezer/kasir baru.
// v1.7.0 (menengah): icon HUD emas/batu bara, HP bar ("darah") jalan juga buat batu
//   tambang (dulu cuma pohon), toko sekarang bisa pilih JUMLAH jual (bukan cuma
//   "jual semua") + keterangan harga live, zona joystick di-cap px biar gak nyerempet
//   tombol lari/lompat, lompatan dikurangi, batas map digeser deket ke batu bukit
//   (dulu ada gap 23 unit sebelum nyampe visualnya).
// v1.6.1 (kecil): rumput/batu gak lagi numbuh nembus toko & rumah (margin 15 unit),
//   zona sentuh joystick ditarik balik ke pojok kiri-bawah aja (dulu 60%x70% kelewat
//   luas, gangguin swipe-kamera).
// v1.6.0 (menengah): tambang emas & batu bara (batu tandai warna, ditambang pakai kapak
//   yang sama, dijual di toko - lihat ORE_TYPES di game.js), popup peta besar bisa
//   digeser (klik minimap), fix isPaused nyangkut true kalau modal ditutup lewat tombol
//   back, exitApp() sekarang hentiin semua audio+loop game total sebelum coba nutup app.
// v1.5.1 (kecil): balon obrolan & info rumah diturunkan (posisi kemarin kegedean),
//   teks panduan di-justify, zona sentuh joystick diperbesar (55%->60%x70%).
// v1.0.1: tambah androidx.webkit (WebViewAssetLoader) - fix asset gagal dimuat, lihat MainActivity.kt.
// v1.1.0 (menengah): fix icon fa-regular (jam) gak ke-load, ganti semua icon emoji jadi Font
//   Awesome, tambah batu hiasan, animasi nebang & pegang kapak pakai klip asli character.glb
//   (attack-melee-left / holding-left), fix kamera ikut naik pas lompat.
// v1.2.0 (menengah): footer versi/tanggal di game, tuning posisi kapak (grip offset),
//   batu jadi solid (collision), fix rentang pitch kamera beda potret/landscape, reset
//   pitch kamera otomatis pas HP diputar.
// v1.3.0 (menengah): pilih karakter (6 pilihan, rig sama semua - lihat CHARACTERS di
//   game.js), indikator arah kamera di minimap, kamera auto-follow di belakang karakter,
//   tombol back HP munculin modal konfirmasi (lihat MainActivity.kt), sync-web.ps1 baru
//   buat otomatis sinkron web->android (dulu manual, sering ketinggalan).
// v1.4.0 (menengah): fix kamera gak mau diam pas jalan/lari (feedback loop antara
//   cameraAngle & player.rotation.y - sekarang cuma satu arah, dikunci selama BERGERAK
//   aja), tambah NPC karyawan toko + balon dialog reaktif (jual kayu/upgrade) di modal toko.
// v1.4.1 (kecil): fix kamera masih muter pas belok/diagonal (auto-follow sekarang cuma
//   aktif kalau jalan lurus ke depan - lihat game.js), hapus tombol "Keluar Game" di menu
//   utama (udah ada popup konfirmasi via tombol back), fix tombol keluar cuma blank putih
//   (AndroidBridge.exitApp -> finishAffinity(), lihat MainActivity.kt).
// v1.5.0 (menengah): fix kulit NPC karyawan gelap (tekstur ketimpa punya karakter kit lain -
//   dipatch pakai colormap sendiri), balon obrolan interaktif di atas kepala player/NPC
//   (bukan di modal toko lagi) dgn tombol Lanjut/Lewati, cone arah kamera di minimap
//   dibikin gradient, balon info di atas rumah (jam tidur), tambah tenda+api unggun,
//   joystick sekarang "mengambang" (nongol tepat di titik jempol, area sentuh diperluas),
//   header modal panduan dikecilkan di HP, gambar karakter aktif di modal status,
//   animasi kembali ke menu utama gak lagi pakai teks "memuat dunia".
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.rimba.tycoon"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.rimba.tycoon"
        minSdk = 24
        targetSdk = 34
        versionCode = 19
        versionName = "2.2.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.13.0")
}
