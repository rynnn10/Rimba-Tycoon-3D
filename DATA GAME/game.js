// VERSI GAME - naikkan tiap ada perubahan (patch=kecil, minor=menengah, major=besar)
// dan update GAME_UPDATED. Ditampilkan di footer (lihat #app-version-tag di index.html).
const GAME_VERSION = "2.2.0";
const GAME_UPDATED = "Sabtu, 25/07/2026 01:15 WIB";
window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#app-version-tag").forEach((el) => {
    el.textContent = `v${GAME_VERSION} - ${GAME_UPDATED}`;
  });
});

// PILIHAN KARAKTER - semua model ini satu rig yang sama persis (arm-left/arm-right/dst
// + 32 animasi yang sama), jadi tinggal ganti file tanpa ubah logic animasi/kapak.
const CHARACTERS = {
  keeper: { name: "Penjaga Hutan", asset: "./assets/character.glb", preview: "./assets/char-previews/keeper.png" },
  skeleton: { name: "Tengkorak", asset: "./assets/char-skeleton.glb", preview: "./assets/char-previews/skeleton.png" },
  zombie: { name: "Zombie", asset: "./assets/char-zombie.glb", preview: "./assets/char-previews/zombie.png" },
  vampire: { name: "Vampir", asset: "./assets/char-vampire.glb", preview: "./assets/char-previews/vampire.png" },
  ghost: { name: "Hantu", asset: "./assets/char-ghost.glb", preview: "./assets/char-previews/ghost.png" },
  employee: { name: "Karyawan Toko", asset: "./assets/char-employee.glb", preview: "./assets/char-previews/employee.png" },
};

// CONFIG
const ASSETS = {
  player: "./assets/character.glb",
  axe: "./assets/kapak.glb", // Level 1
  axe2: "./assets/kapakup.glb", // Level 2 (Max)
  pickaxe: "./assets/pickaxe.glb", // Alat tambang Level 1
  pickaxe2: "./assets/pickaxe-upgraded.glb", // Alat tambang Level 2 (dulu kapak3.glb - ternyata modelnya pickaxe)
  tree1: "./assets/tree.glb", // Pohon 1 (Lama)
  tree2: "./assets/pohon2.glb", // Pohon 2 (Baru - Ganti path jika ada file lain)
  tree3: "./assets/tree-tall.glb", // Pohon 3 (Baru - Ganti path jika ada file lain)
  shop: "./assets/toko.glb",
  home: "./assets/house.glb",
  hill1: "./assets/bukit1.glb",
  grass1: "./assets/rumput1.glb", // Rumput Kecil (Hiasan)
  grass2: "./assets/rumput2.glb", // Rumput Besar (Bisa Sembunyi)
  rock1: "./assets/rock-a.glb", // Batu Hiasan (Kenney survival-kit)
  rock2: "./assets/rock-b.glb", // Batu Hiasan (Kenney survival-kit)
  tent: "./assets/tent.glb", // Tenda kemah (Kenney survival-kit)
  campfire: "./assets/campfire-pit.glb", // Api unggun (Kenney survival-kit)
  hutWall: "./assets/structure.glb", // Badan gubuk toko kedua (Kenney survival-kit)
  hutRoof: "./assets/structure-roof.glb", // Atap gubuk toko kedua
  shelfBags: "./assets/shelf-bags.glb", // Dekor toko kedua (Kenney mini-market)
  shelfBoxes: "./assets/shelf-boxes.glb",
  displayBread: "./assets/display-bread.glb",
  displayFruit: "./assets/display-fruit.glb",
  freezer: "./assets/freezer.glb",
  cashRegister: "./assets/cash-register.glb",
};
const AXE_CONFIG = {
  x: 0.22, // dekat ujung lengan (bbox arm-left: 0..0.28 lokal)
  y: 0.02, // center ke penampang lengan (bbox arm-left: -0.0816..0.0816), dulu 0.1 = ngambang di atas lengan
  z: 0,
  rotX: Math.PI / 2,
  rotY: Math.PI,
  rotZ: 0,
};
// Semua model kapak & pickaxe (satu kit yang sama - kenney_survival-kit) originnya
// di PANGKAL gagang (y=0), gagang memanjang ke atas ~0.24-0.256. Geser mesh turun
// biar titik genggam (bukan pangkal gagang) yang nempel di tangan - gagang keliatan
// nongol di bawah & atas genggaman. AXE_CONFIG/AXE_GRIP_OFFSET_Y dipakai bareng buat
// pickaxe juga (sama konvensi origin-nya, gak perlu config kedua).
const AXE_GRIP_OFFSET_Y = -0.08;

// ponytail: 158 (fix sesi sebelumnya) ternyata overshoot - hill discale (35,50,35)
// punya kedalaman radial ~50.7 unit berpusat di radius 163, jadi badan hill nutupin
// radius ~137.7-188.3 dari pusat map. 158 nyemplung DI TENGAH rentang itu (makanya
// karakter ke-embed masuk badan hill). 137 = tepat di tepi DALAM hill (sebelum
// badannya mulai) - karakter jalan sampai NEMPEL permukaan hill, gak nembus masuk.
const MAP_RADIUS_COLLISION = 137;
const HILL_VISUAL_RADIUS = 163;
const COLLISION_RADII = { shop: 3.5, home: 5.5, tree: 2.5, player: 1.0 };
const INTERACTION_RADII = { shop: 12.0, home: 12.0 };
const STORE2_POS = { x: -40, z: 40 }; // toko kedua ("general store") - jauh dari toko/rumah utama

// GLOBALS
// ponytail: MAX_AXE_LEVEL dulu 3, tapi model "level 3" (kapak3.glb) ternyata pickaxe
// beneran (nama internal file "tool-pickaxe-upgraded"), bukan kapak. Dipisah: kapak
// max 2 level (axe/axe-upgraded asli), pickaxe alat tambang sendiri max 2 level.
const MAX_AXE_LEVEL = 2;
const MAX_PICKAXE_LEVEL = 2;
let staminaRegenTimer = 0; // Timer penunda regenerasi stamina
let autoSaveTimer = 0; // <--- TAMBAHKAN INI (Untuk hitung waktu save saat jalan)
let scene, camera, renderer, clock, loader;
let player, mixer, axeMesh, pickaxeMesh, handContainer;
let equippedTool = "axe"; // "axe" atau "pickaxe" - ganti otomatis sesuai target terdekat (lihat checkInteractions)
let employeeMixer; // mixer buat animasi idle NPC karyawan toko
let employeeNpc = null; // referensi objek 3D NPC (buat cek jarak & posisi balon obrolan)
let leftArmBone = null; // node lengan kiri, dipakai buat blend pose "pegang kapak"
let armHoldQuat = null; // rotasi lengan dari klip animasi "holding-left" (glb sudah punya, tinggal pakai)
let actions = {},
  activeAction;
let trees = [],
  hills = [],
  rocks = [],
  oreRocks = [],
  oreRockModels = [];

// Tambang emas & batu bara - dipatok pola Stardew Valley (batu ditambang pakai
// alat yang sama, dijual di toko, harga beda tingkat) tapi tanpa alat/smelting
// terpisah biar tetap simpel: dipakai axeDamage yang sama kayak nebang pohon.
const ORE_TYPES = {
  gold: { color: 0xffd700, hp: 4, reward: 1, sellPrice: 20, label: "Emas" },
  coal: { color: 0x2c2c2c, hp: 3, reward: 2, sellPrice: 8, label: "Batu Bara" },
};
grasses = []; // Array untuk rumput besar (untuk logika sembunyi)
let treeModels = { type1: null, type2: null, type3: null };
let shopArea, homeArea, sunLight, hemiLight, skyMesh;
let groundMesh; // referensi plane tanah - dipakai applyLevelTheme() buat ganti warna per level
let themeDecor = []; // prop dekorasi tema level saat ini (dibersihkan/diisi ulang tiap ganti level)
let isPaused = true;
let gameStarted = false;

// --- UPDATE KAMERA ---
let cameraZoom = 1.0;
let cameraAngle = 0; // Sudut putar kamera (0 = default)
let cameraPitch = 0; // TAMBAHAN: Variabel untuk tinggi/rendah kamera (Pitch)
let isRotating = false; // Status putar (Laptop)
let lastMouseX = 0; // Posisi mouse terakhir X
let lastMouseY = 0; // TAMBAHAN: Posisi mouse terakhir Y
let lastTouchX = 0;
let lastTouchY = 0; // TAMBAHAN: Posisi sentuh terakhir Y
let touchStartDist = 0;
let cameraIdleTimer = 0; // detik sejak terakhir user geser kamera manual (buat auto-follow di belakang karakter)
// ---------------------

// Physics
let yVelocity = 0,
  isJumping = false,
  isRunning = false;
const GRAVITY = 0.05,
  JUMP_FORCE = 0.32, // dikurangi lagi (0.65 -> 0.52 -> 0.4 -> 0.32) - masih kelihatan ketinggian
  WALK_SPEED = 12.0,
  RUN_SPEED = 25.0;
const joystick = { x: 0, y: 0, active: false, originX: 0, originY: 0 };
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Enter: false,
  Space: false,
  Shift: false,
};

let state = {
  wood: 0,
  gold: 0,
  coal: 0,
  coins: 0,
  axeLevel: 1,
  axeDamage: 1,
  pickaxeLevel: 0, // 0 = belum punya (menambang gak bisa sampai beli di toko)
  pickaxeDamage: 0,
  stamina: 100,
  maxStamina: 100,
  nearTree: null,
  nearShop: false,
  nearHome: false,
  isChopping: false,
  isNight: false,
  lastPlayedDate: "", // buat bonus harian - lihat checkDailyBonus()
  lifetimeCoinsEarned: 0, // TOTAL koin sepanjang permainan, gak pernah berkurang (beda dari state.coins) - dasar achievement
  milestonesSeen: [], // daftar threshold achievement yang udah pernah muncul, biar gak muncul ulang
  currentLevel: 1, // level/tema map saat ini - lihat LEVEL_THEMES & advanceLevel()
  questsClaimed: [], // key "level-index" misi yang hadiahnya udah diambil - lihat claimQuest()
};

let pendingSaveData = null; // Variabel sementara untuk menyimpan data posisi saat load

// Karakter yang dipilih - disimpan terpisah dari save-game (spt preferensi volume),
// biar gak ikut ke-reset pas "Mulai Baru".
let selectedCharacter = localStorage.getItem("rimbaCharacter") || "keeper";
function selectCharacter(id) {
  if (!CHARACTERS[id]) return;
  selectedCharacter = id;
  localStorage.setItem("rimbaCharacter", id);
  renderCharacterPicker();
}
function renderCharacterPicker() {
  const list = document.getElementById("character-picker-list");
  if (!list) return;
  list.innerHTML = "";
  Object.keys(CHARACTERS).forEach((id) => {
    const c = CHARACTERS[id];
    const active = id === selectedCharacter;
    const card = document.createElement("button");
    card.className =
      "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition " +
      (active
        ? "border-green-500 bg-green-50"
        : "border-gray-200 bg-white hover:border-green-300");
    card.onclick = () => selectCharacter(id);
    card.innerHTML = `<img src="${c.preview}" class="w-16 h-16 object-contain" /><span class="text-xs font-bold text-gray-700">${c.name}</span>`;
    list.appendChild(card);
  });
}
function openCharacterPicker() {
  renderCharacterPicker();
  document.getElementById("character-modal").classList.remove("hidden");
}
function closeCharacterPicker() {
  document.getElementById("character-modal").classList.add("hidden");
}

// --- ON LOAD (Persistence Check) ---
window.addEventListener("load", () => {
  if (localStorage.getItem("penebangSave")) {
    const btnContinue = document.getElementById("btn-continue");
    btnContinue.classList.remove("hidden");
  }
});

// --- MENU SYSTEM ---
function startGame() {
  localStorage.removeItem("penebangSave");
  state = {
    wood: 0,
    gold: 0,
    coal: 0,
    coins: 0,
    axeLevel: 1,
    axeDamage: 1,
    pickaxeLevel: 0,
    pickaxeDamage: 0,
    stamina: 100,
    maxStamina: 100,
    nearTree: null,
    nearShop: false,
    nearHome: false,
    isChopping: false,
    isNight: false,
    lastPlayedDate: "",
    lifetimeCoinsEarned: 0,
    milestonesSeen: [],
    currentLevel: 1,
    questsClaimed: [],
  };
  pendingSaveData = null;
  if (player && handContainer) {
    changeAxeModel(1);
  }

  if (gameStarted) {
    updateHUD();
    updateStaminaUI();
  }

  document.getElementById("start-screen").style.display = "none";
  const loadingScreen = document.getElementById("loading");
  updateLoadingUIState(); // Cek apakah download atau load biasa
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hidden");

  const sleepScreen = document.getElementById("sleep-screen");
  sleepScreen.classList.add("hidden");
  sleepScreen.style.display = "none";

  if (!gameStarted) {
    init();
    gameStarted = true;
  } else {
    if (player) {
      player.position.set(0, 0, 0);
      player.rotation.set(0, 0, 0);
    }
    setTimeout(() => {
      loadingScreen.style.display = "none";
      document.getElementById("game-ui").classList.remove("hidden");
      isPaused = false;
    }, 500);
  }
  document.getElementById("btn-continue").classList.remove("hidden");
}

function continueGame() {
  const loadingScreen = document.getElementById("loading");
  const startScreen = document.getElementById("start-screen");

  // --- TAMBAHAN: Pastikan layar tidur tertutup saat load ---
  const sleepScreen = document.getElementById("sleep-screen");
  sleepScreen.classList.add("hidden");
  sleepScreen.style.display = "none";

  // 1. Tampilkan Loading Screen Dulu (Supaya transisi halus seperti game baru)
  startScreen.style.display = "none";
  updateLoadingUIState(); // Cek status teks loading
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hidden");

  // Gunakan timeout agar loading screen terlihat sejenak
  setTimeout(() => {
    if (!gameStarted) {
      // Jika reload halaman (load dari LocalStorage)
      loadSaveData();
      init();
      gameStarted = true;
    } else {
      // Jika kembali dari Menu Utama (Unpause)
      loadingScreen.style.display = "none";
      document.getElementById("game-ui").classList.remove("hidden");
      isPaused = false;

      // --- PERBAIKAN: Nyalakan kembali musik jika sebelumnya menyala ---
      const bgmAudio = document.getElementById("bgm");
      if (!isBGMMuted && bgmAudio.paused) {
        bgmAudio.play().catch((e) => console.log("BGM autoplay prevented", e));
      }
      // ---------------------------------------------------------------
    }
  }, 1000); // Jeda 1 detik untuk loading visual
}

// --- LOADING CONTENT (DENGAN PROGRESS BAR & OFFLINE READY) ---
function loadContent() {
  // 1. Setup Loading Manager untuk melacak progress download
  const manager = new THREE.LoadingManager();

  // A. Saat Progress Berjalan (Update Bar & Teks)
  manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const pct = Math.floor((itemsLoaded / itemsTotal) * 100);

    // Update UI HTML
    const bar = document.getElementById("loading-bar-fill");
    const txt = document.getElementById("loading-text");

    if (bar) bar.style.width = pct + "%";
    if (txt) txt.innerText = pct + "%";

    console.log(`Loading file: ${url} (${itemsLoaded}/${itemsTotal})`);
  };

  // B. Saat Semua Selesai (Masuk Game)
  // ponytail: `loader` (dengan manager ini) dipakai lagi belakangan oleh
  // changeAxeModel()/changePickaxeModel() (dipanggil ensureToolEquipped(), sekarang
  // lewat tombol ganti senjata manual) - tiap loader.load() baru bikin manager ini
  // nge-trigger onLoad LAGI begitu load-nya selesai, jadi toast "SIAP DIMAINKAN
  // OFFLINE" nongol ulang tiap ganti alat. Guard sekali jalan biar cuma nyala pas
  // load awal beneran.
  let initialContentLoaded = false;
  manager.onLoad = function () {
    if (initialContentLoaded) return;
    initialContentLoaded = true;
    console.log("Semua aset terunduh! Game siap Offline.");
    localStorage.setItem("rimbaAssetsCached", "true");

    // Sembunyikan Loading Screen
    document.getElementById("loading").style.display = "none";
    document.getElementById("game-ui").classList.remove("hidden");

    // Mulai Musik & Game
    isPaused = false;
    const bgmAudio = document.getElementById("bgm");
    if (bgmAudio.volume > 0) {
      bgmAudio.play().catch((e) => {});
    }

    // Tampilkan Notifikasi Khusus
    showToast("SIAP DIMAINKAN OFFLINE!", "success");

    // Bonus harian - dicek di sini (bukan di loadSaveData) biar jalan juga buat
    // "Mulai Baru" (gak lewat loadSaveData sama sekali), dan cuma sekali per
    // sesi karena initialContentLoaded udah di-guard di atas.
    checkDailyBonus();
  };

  // C. Jika Error
  manager.onError = function (url) {
    console.log("Ada error saat memuat " + url);
    showToast("Gagal memuat beberapa aset.", "error");
  };

  // 2. Pasang Manager ke Loader
  // PENTING: Loader lama ditimpa dengan loader baru yang punya manager
  loader = new THREE.GLTFLoader(manager);

  // --- MULAI PROSES LOAD ASET SEPERTI BIASA (KODE LAMA DI BAWAH SINI) ---

  // Load Player (aset ikut karakter yang dipilih di menu utama)
  loader.load(
    (CHARACTERS[selectedCharacter] || CHARACTERS.keeper).asset,
    (gltf) => {
      player = gltf.scene;
      player.scale.set(2.0, 2.0, 2.0);
      if (pendingSaveData) {
        player.position.set(pendingSaveData.pos.x, 0, pendingSaveData.pos.z);
        player.rotation.y = pendingSaveData.pos.rot;
        cameraAngle = pendingSaveData.camAngle;
        pendingSaveData = null;
      } else {
        player.position.set(0, 0, 0);
      }
      player.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(player);

      handContainer = new THREE.Object3D();
      handContainer.position.set(AXE_CONFIG.x, AXE_CONFIG.y, AXE_CONFIG.z);
      leftArmBone = player.getObjectByName("arm-left");
      if (leftArmBone) {
        leftArmBone.add(handContainer);
      } else {
        player.add(handContainer);
      }

      const anims = gltf.animations;
      if (anims && anims.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        const idle =
          anims.find((c) => c.name.toLowerCase().includes("idle")) || anims[0];
        const run =
          anims.find((c) => c.name.toLowerCase().includes("run")) ||
          anims.find((c) => c.name.toLowerCase().includes("walk")) ||
          anims[1];
        actions["Idle"] = mixer.clipAction(idle);
        actions["Run"] = mixer.clipAction(run);

        // Load Jump Animation jika ada (opsional, sesuaikan nama animasi di model)
        const jumpAnim = anims.find((c) =>
          c.name.toLowerCase().includes("jump")
        );
        if (jumpAnim) actions["Jump"] = mixer.clipAction(jumpAnim);

        // Animasi nebang asli dari model (gerakan mengayun kapak beneran, bukan spin badan)
        const chopAnim = anims.find((c) => c.name === "attack-melee-left");
        if (chopAnim) {
          actions["Chop"] = mixer.clipAction(chopAnim);
          actions["Chop"].setLoop(THREE.LoopOnce);
          actions["Chop"].clampWhenFinished = true;
        }

        // Pose "pegang barang" bawaan model - dipakai buat blend lengan kiri tiap
        // frame biar kapak kelihatan digenggam, bukan cuma nempel diam di lengan.
        const holdAnim = anims.find((c) => c.name === "holding-left");
        if (holdAnim) {
          const track = holdAnim.tracks.find(
            (t) => t.name === "arm-left.quaternion"
          );
          if (track) {
            armHoldQuat = new THREE.Quaternion(
              track.values[0],
              track.values[1],
              track.values[2],
              track.values[3]
            );
          }
        }

        actions["Idle"].play();
        activeAction = actions["Idle"];
      }

      // Load Kapak Awal (Logic Leveling) - max Lv.2, lihat catatan MAX_AXE_LEVEL.
      // Save lama yang masih punya axeLevel:3 otomatis kepakai model Lv.2 di sini
      // (gak error walau datanya lebih tinggi dari MAX_AXE_LEVEL sekarang).
      let currentAxeAsset = ASSETS.axe;
      let currentScale = 1.0;
      if (state.axeLevel >= 2) {
        currentAxeAsset = ASSETS.axe2;
        currentScale = 1.2;
      }

      loader.load(
        currentAxeAsset,
        (axeGltf) => {
          axeMesh = axeGltf.scene;
          axeMesh.scale.set(currentScale, currentScale, currentScale);
          axeMesh.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          axeMesh.rotation.set(
            AXE_CONFIG.rotX,
            AXE_CONFIG.rotY,
            AXE_CONFIG.rotZ
          );
          axeMesh.position.set(0, AXE_GRIP_OFFSET_Y, 0);
          handContainer.add(axeMesh);
        },
        undefined,
        (e) => console.warn("Gagal load kapak", e)
      );
    },
    undefined,
    (e) => console.error("Player Error", e) // Error ditangani Manager
  );

  // Load Shop
  loader.load(ASSETS.shop, (gltf) => {
    const shop = gltf.scene;
    shop.position.copy(shopArea.position);
    shop.scale.set(4.5, 4.5, 4.5);
    shop.rotation.y = Math.PI;
    shop.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(shop);
  });

  // Load NPC Karyawan (dekat toko, ngobrol kalau didekati - lihat updateEmployeeChat)
  loader.load(CHARACTERS.employee.asset, (gltf) => {
    const npc = gltf.scene;
    npc.scale.set(2, 2, 2); // rig & skala sama kayak player
    // shopArea di (25,-15) radius 9, badan toko collision-radius 3.5. Taruh ~5 unit
    // dari pusat toko ke arah tengah peta - di luar badan toko, masih di lingkaran kuning.
    npc.position.set(20.5, 0, -12);
    npc.rotation.y = -1.03; // hadap kira-kira ke arah tengah peta (tunable pas dicoba)
    npc.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(npc);
    employeeNpc = npc;
    employeeMixer = new THREE.AnimationMixer(npc);
    const idle =
      gltf.animations.find((c) => c.name.toLowerCase().includes("idle")) ||
      gltf.animations[0];
    if (idle) employeeMixer.clipAction(idle).play();
  });

  // Load Home
  loader.load(ASSETS.home, (gltf) => {
    const home = gltf.scene;
    home.position.copy(homeArea.position);
    home.scale.set(9.0, 9.0, 9.0);
    home.rotation.y = Math.PI / 2;
    home.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(home);
  });

  // Load Hill (Environment)
  loader.load(ASSETS.hill1, (gltf) => {
    const model = gltf.scene;
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const hx = Math.cos(angle) * HILL_VISUAL_RADIUS;
      const hz = Math.sin(angle) * HILL_VISUAL_RADIUS;
      const hill = model.clone();
      hill.position.set(hx, -2, hz);
      hill.lookAt(0, 0, 0);
      hill.scale.set(35, 50, 35);
      hill.traverse((o) => {
        if (o.isMesh) o.receiveShadow = true;
      });
      scene.add(hill);
    }
  });

  // Load Rumput Kecil
  loader.load(ASSETS.grass1, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) o.material.color.setHex(0x4caf50);
    });
    for (let i = 0; i < 100; i++) {
      const g = model.clone();
      const pos = randomDecorPosition();
      if (!pos) continue;
      g.position.set(pos.x, 0, pos.z);
      g.scale.set(4.5, 4.5, 4.5);
      g.rotation.y = Math.random() * Math.PI;
      scene.add(g);
    }
  });

  // Load Rumput Besar
  loader.load(ASSETS.grass2, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) o.material.color.setHex(0x388e3c);
    });
    for (let i = 0; i < 40; i++) {
      const g = model.clone();
      const pos = randomDecorPosition();
      if (!pos) continue;
      g.position.set(pos.x, 0, pos.z);
      g.scale.set(7.5, 7.5, 7.5);
      g.rotation.y = Math.random() * Math.PI;
      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(g);
      grasses.push(g);
    }
  });

  // Load Batu Hiasan (dari Kenney survival-kit, 2 varian disebar acak)
  [ASSETS.rock1, ASSETS.rock2].forEach((rockAsset) => {
    loader.load(rockAsset, (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
        if (o.isMesh) o.receiveShadow = true;
      });
      oreRockModels.push(model); // simpan referensi buat batu tambang (di bawah)
      for (let i = 0; i < 18; i++) {
        const r = model.clone();
        const pos = randomDecorPosition();
        if (!pos) continue;
        r.position.set(pos.x, 0, pos.z);
        const s = 3.0 + Math.random() * 2.5;
        r.scale.set(s, s, s);
        r.rotation.y = Math.random() * Math.PI * 2;
        r.userData = { collisionRadius: s * 0.4 }; // biar gak bisa ditembus jalan
        scene.add(r);
        rocks.push(r);
      }
      if (oreRockModels.length === 2) spawnInitialOreRocks();
    });
  });

  // Load Kemah (tenda + api unggun) - beberapa titik kemah tersebar biar dunia lebih rame
  let tentModel, campfireModel;
  function trySpawnCamps() {
    if (!tentModel || !campfireModel) return;
    for (let i = 0; i < 5; i++) {
      let tx, tz, tries = 0, valid = false;
      while (!valid && tries < 30) {
        tries++;
        tx = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
        tz = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
        const posVec = new THREE.Vector3(tx, 0, tz);
        if (posVec.length() < 30) continue;
        if (posVec.length() > MAP_RADIUS_COLLISION) continue; // jangan sampe nembus ring bukit
        if (posVec.distanceTo(shopArea.position) < 20) continue;
        if (posVec.distanceTo(homeArea.position) < 20) continue;
        if (Math.hypot(tx - STORE2_POS.x, tz - STORE2_POS.z) < 15) continue; // toko kedua
        valid = true;
      }
      if (!valid) continue;

      const tent = tentModel.clone();
      tent.position.set(tx, 0, tz);
      tent.scale.set(4, 4, 4);
      tent.rotation.y = Math.random() * Math.PI * 2;
      tent.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      tent.userData = { collisionRadius: 3.0 };
      scene.add(tent);
      rocks.push(tent); // reuse pengecekan collision batu buat tenda (sama-sama solid)

      const fire = campfireModel.clone();
      const fireAngle = Math.random() * Math.PI * 2;
      fire.position.set(
        tx + Math.cos(fireAngle) * 4,
        0,
        tz + Math.sin(fireAngle) * 4
      );
      fire.scale.set(3, 3, 3);
      fire.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      scene.add(fire);
    }
  }
  loader.load(ASSETS.tent, (gltf) => {
    tentModel = gltf.scene;
    trySpawnCamps();
  });
  loader.load(ASSETS.campfire, (gltf) => {
    campfireModel = gltf.scene;
    trySpawnCamps();
  });

  // Toko kedua ("general store") - gubuk (badan+atap, sama pola tenda) + dekor rak/
  // etalase/freezer/kasir dari kenney_mini-market. Murni dekorasi, gak ada NPC/jual-beli
  // baru di titik ini (lihat catatan di plan - opsi yang dipilih user).
  // STORE2_POS deklarasi global (dipakai lagi buat exclusion zone spawn pohon/batu/kemah).
  const STORE2_WALL_SCALE = 8;

  loader.load(ASSETS.hutWall, (gltf) => {
    const wall = gltf.scene.clone();
    wall.position.set(STORE2_POS.x, 0, STORE2_POS.z);
    wall.scale.set(STORE2_WALL_SCALE, STORE2_WALL_SCALE, STORE2_WALL_SCALE);
    wall.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(wall);
  });

  loader.load(ASSETS.hutRoof, (gltf) => {
    const roof = gltf.scene.clone();
    roof.position.set(STORE2_POS.x, STORE2_WALL_SCALE * 0.5, STORE2_POS.z); // pas di atas badan gubuk
    roof.scale.set(STORE2_WALL_SCALE, STORE2_WALL_SCALE, STORE2_WALL_SCALE);
    roof.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    scene.add(roof);
  });

  [
    { asset: ASSETS.shelfBags, dx: -2.5, dz: -2.5, scale: 2.5 },
    { asset: ASSETS.shelfBoxes, dx: 2.5, dz: -2.5, scale: 2.5 },
    { asset: ASSETS.displayFruit, dx: -2.5, dz: 2.5, scale: 2.5 },
    { asset: ASSETS.displayBread, dx: 2.5, dz: 2.5, scale: 2.5 },
    { asset: ASSETS.freezer, dx: 0, dz: 3.2, scale: 2.5 },
    { asset: ASSETS.cashRegister, dx: 0, dz: -3.2, scale: 2.0 },
  ].forEach((item) => {
    loader.load(item.asset, (gltf) => {
      const deco = gltf.scene;
      deco.position.set(STORE2_POS.x + item.dx, 0, STORE2_POS.z + item.dz);
      deco.scale.set(item.scale, item.scale, item.scale);
      deco.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(deco);
    });
  });

  // Load Pohon-pohon (Counter logic inside manager handles completion)
  let treesToLoad = 3;
  function onTreeLoaded() {
    treesToLoad--;
    if (treesToLoad === 0) {
      spawnInitialTrees();
    }
  }

  loader.load(ASSETS.tree1, (gltf) => {
    treeModels.type1 = gltf.scene;
    onTreeLoaded();
  });
  loader.load(ASSETS.tree2, (gltf) => {
    treeModels.type2 = gltf.scene;
    onTreeLoaded();
  });
  loader.load(ASSETS.tree3, (gltf) => {
    treeModels.type3 = gltf.scene;
    onTreeLoaded();
  });

  // --- TAMBAHAN: PRELOAD SEMUA ASET KAPAK & PICKAXE (OFFLINE READY) ---
  // Kita panggil loader untuk semua level alat agar file .glb didownload
  // dan disimpan oleh Service Worker, walaupun belum dipasang ke karakter.
  loader.load(ASSETS.axe, () => {}); // Preload Kapak Lv 1
  loader.load(ASSETS.axe2, () => {}); // Preload Kapak Lv 2
  loader.load(ASSETS.pickaxe, () => {}); // Preload Pickaxe Lv 1
  loader.load(ASSETS.pickaxe2, () => {}); // Preload Pickaxe Lv 2
}

// --- AUDIO SYSTEM ---
let isBGMMuted = false;
let isSFXMuted = false;
let lastBGMVol = 0.4;
let lastSFXVol = 1.0;

function toggleBGM() {
  isBGMMuted = !isBGMMuted;
  const btn = document.getElementById("btn-mute-bgm");
  const slider = document.getElementById("bgm-slider");
  const audio = document.getElementById("bgm");

  if (isBGMMuted) {
    lastBGMVol = parseFloat(slider.value) || 0.4;
    audio.volume = 0;
    slider.value = 0;
    btn.innerHTML = '<i class="fa-solid fa-volume-xmark text-red-500"></i> OFF';
  } else {
    const target = lastBGMVol > 0 ? lastBGMVol : 0.4;
    audio.volume = target;
    slider.value = target;
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

function toggleSFX() {
  // Cek kondisi saat ini
  if (isSFXMuted) {
    // KASUS: MAU NYALA (UNMUTE)
    let targetVol = lastSFXVol > 0 ? lastSFXVol : 1.0;
    setSFXVolume(targetVol);

    // Baris showToast dihapus agar tidak muncul notif
  } else {
    // KASUS: MAU MATI (MUTE)
    const slider = document.getElementById("sfx-slider");
    if (slider && slider.value > 0) {
      lastSFXVol = parseFloat(slider.value);
    }
    setSFXVolume(0);

    // Baris showToast dihapus agar tidak muncul notif
  }

  // Simpan status mute ke storage
  localStorage.setItem("rimbaMuteSFX", !isSFXMuted);
}

// --- TAMBAHKAN FUNGSI INI AGAR EROR HILANG ---
function loadSettings() {
  // Load BGM Volume
  const savedBGM = localStorage.getItem("rimbaBGMVolume");
  if (savedBGM !== null) {
    setBGMVolume(savedBGM);
  } else {
    // Default BGM (misal 40%)
    setBGMVolume(0.4);
  }

  // Load SFX Volume
  const savedSFX = localStorage.getItem("rimbaSFXVolume");

  if (savedSFX !== null) {
    // Jika ada simpanan, pakai itu
    setSFXVolume(savedSFX);
  } else {
    // --- PERBAIKAN: JIKA BARU MAIN, DEFAULT 100% ---
    setSFXVolume(1.0);
  }

  // Pastikan variabel internal diset ke NYALA (Sesuai request sebelumnya)
  isSFXMuted = false;

  // Pastikan Tombol di UI Menampilkan "ON"
  const btn = document.getElementById("btn-mute-sfx");
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

// Ganti fungsi setBGMVolume (sekitar baris 811 di game.js)
function setBGMVolume(val) {
  document.getElementById("bgm").volume = val;

  // Update UI Slider BGM ( Sinkronisasi )
  const bgmSlider = document.getElementById("bgm-slider");
  if (bgmSlider) {
    bgmSlider.value = val;
  }

  // Update Ikon Mute BGM manual
  const btn = document.getElementById("btn-mute-bgm");
  if (val <= 0) {
    isBGMMuted = true;
    if (btn)
      btn.innerHTML =
        '<i class="fa-solid fa-volume-xmark text-red-500"></i> OFF';
  } else {
    isBGMMuted = false;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

function setSFXVolume(val) {
  const sfxVol = parseFloat(val);
  if (isNaN(sfxVol)) return;

  // --- TAMBAHAN PENTING: Simpan memori volume ---
  // Jika volume > 0, simpan sebagai referensi 'lastSFXVol'
  if (sfxVol > 0) {
    lastSFXVol = sfxVol;
  }
  // ----------------------------------------------

  // Update volume semua audio element
  const audioIds = [
    "sfx-chop",
    "sfx-jump",
    "sfx-coin",
    "sfx-fail",
    "sfx-fall",
    "sfx-step",
    "sfx-run",
  ];
  audioIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.volume = sfxVol;
  });

  localStorage.setItem("rimbaSFXVolume", sfxVol);

  // Update Posisi Slider UI (Bar otomatis geser)
  const sfxSlider = document.getElementById("sfx-slider");
  if (sfxSlider) sfxSlider.value = val;

  // Update Tampilan Tombol ON/OFF
  const btn = document.getElementById("btn-mute-sfx");
  if (val <= 0) {
    isSFXMuted = true;
    if (btn)
      btn.innerHTML =
        '<i class="fa-solid fa-volume-xmark text-red-500"></i> OFF';
  } else {
    isSFXMuted = false;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

function playSound(id) {
  const el = document.getElementById(id);
  if (el) {
    el.currentTime = 0;
    el.play().catch((e) => {});
  }
}

function goToMainMenu() {
  // 1. Simpan Game & Tutup Setting
  saveGame();
  closeSettings();

  // 2. Pause Game Loop
  isPaused = true;

  // 3. Ambil Elemen UI
  const gameUI = document.getElementById("game-ui");
  const startScreen = document.getElementById("start-screen");
  const loadingScreen = document.getElementById("loading");

  // 4. --- ANIMASI LOADING ---
  // Sembunyikan Game UI
  gameUI.classList.add("hidden");

  // Teks/ikon khusus "kembali ke menu" - dulu ikut teks default #loading ("MEMUAT
  // DUNIA...") yang kebawa dari layar masuk game, padahal ini KELUAR dunia, bukan masuk.
  const lTitle = document.getElementById("loading-title");
  const lDesc = document.getElementById("loading-desc");
  const lIcon = document.getElementById("loading-icon");
  if (lTitle) lTitle.innerText = "KEMBALI KE MENU...";
  if (lDesc)
    lDesc.innerHTML = "<i class='fa-solid fa-house'></i> Sampai jumpa lagi!";
  if (lIcon) lIcon.innerHTML = '<i class="fa-solid fa-house"></i>';

  // Tampilkan Loading Screen
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hidden");

  // Reset Joystick (Penting agar tidak nyangkut)
  if (joystick) {
    joystick.x = 0;
    joystick.y = 0;
    joystick.active = false;
    const stick = document.getElementById("joystick-stick");
    if (stick) stick.style.transform = `translate(0px, 0px)`;
  }

  // Tunggu 1.5 detik seolah-olah sedang memuat menu
  setTimeout(() => {
    // Sembunyikan Loading
    loadingScreen.style.display = "none";
    loadingScreen.classList.add("hidden");

    // Tampilkan Start Screen (Menu Utama)
    startScreen.style.display = "flex"; // Pastikan flex agar layout terjaga

    // Hapus Karakter/Scene Game agar bersih (Opsional, tapi bagus untuk performa)
    // Di sini kita biarkan scene di background, tapi hentikan update logic

    // Pastikan tombol "Lanjutkan" muncul jika ada save data
    const btnContinue = document.getElementById("btn-continue");
    if (localStorage.getItem("penebangSave")) {
      btnContinue.classList.remove("hidden");
    }

    // Pastikan audio BGM direset atau disesuaikan jika perlu
    // const bgm = document.getElementById("bgm");
    // bgm.currentTime = 0;
  }, 1500); // Durasi loading 1.5 detik
}

function openSettings() {
  isPaused = true;
  document.getElementById("settings-modal").classList.remove("hidden");
}
function openStats() {
  // Tutup setting, buka stats
  const setModal = document.getElementById("settings-modal");
  const statModal = document.getElementById("stats-modal");

  if (setModal) setModal.classList.add("hidden");
  if (statModal) statModal.classList.remove("hidden");

  // Isi data teks
  const elAxe = document.getElementById("stat-axe-lvl");
  const elDmg = document.getElementById("stat-dmg");
  const elStam = document.getElementById("stat-stamina");
  const elCoin = document.getElementById("stat-coins");
  const elWood = document.getElementById("stat-wood");

  if (elAxe) elAxe.innerText = "Lv. " + state.axeLevel;
  if (elDmg) elDmg.innerText = state.axeDamage + " Hit";
  if (elStam)
    elStam.innerText = Math.floor(state.stamina) + " / " + state.maxStamina;
  if (elCoin) elCoin.innerText = state.coins;
  if (elWood) elWood.innerText = state.wood;

  // Gambar karakter yang lagi dipakai
  const statCharImg = document.getElementById("stat-character-img");
  if (statCharImg) {
    statCharImg.src = (CHARACTERS[selectedCharacter] || CHARACTERS.keeper).preview;
  }

  // --- PERBAIKAN: Update Gambar Kapak Sesuai Level ---
  const statAxeImg = document.getElementById("stat-axe-img");
  if (statAxeImg) {
    let imgPath = "assets/kapak.png"; // Default Lv 1

    if (state.axeLevel >= 2) {
      imgPath = "assets/kapakup.png"; // Lv 2 (Max)
    }

    statAxeImg.src = imgPath;
  }
}
function closeSettings() {
  isPaused = false;
  closeModalWithAnimation("settings-modal");
}

function closeStats() {
  closeModalWithAnimation("stats-modal", () => {
    // Buka kembali settings setelah stats tertutup (opsional, sesuai flow lama)
    document.getElementById("settings-modal").classList.remove("hidden");
  });
}

function closeInfo() {
  closeModalWithAnimation("info-modal", () => {
    if (gameStarted && isPaused) {
      document.getElementById("settings-modal").classList.remove("hidden");
    }
  });
}

// --- CORE LOGIC ---
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 15, 18);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  loader = new THREE.GLTFLoader();

  const sleepScreen = document.getElementById("sleep-screen");
  if (sleepScreen) {
    sleepScreen.classList.add("hidden");
    sleepScreen.style.display = "none";
  }
  isPaused = false; // Pastikan game tidak ter-pause

  setupLighting();
  createEnvironment();
  applyLevelTheme(state.currentLevel); // pasang tema map sesuai level tersimpan (default level 1 = hutan)
  setupControls();
  loadSettings();
  const sfxVol = document.getElementById("sfx-slider").value || 1.0;

  // Update baris volume audio
  document.getElementById("sfx-chop").volume = sfxVol;
  document.getElementById("sfx-jump").volume = sfxVol;
  document.getElementById("sfx-coin").volume = sfxVol;
  document.getElementById("sfx-fail").volume = sfxVol;
  document.getElementById("sfx-fall").volume = sfxVol;
  document.getElementById("sfx-step").volume = sfxVol;
  document.getElementById("sfx-run").volume = sfxVol; // TAMBAHKAN INI

  document.getElementById("action-btn").onclick = handleAction;
  document.getElementById("sleep-btn").onclick = sleep;

  loadContent();
  setInterval(updateRealTimeClock, 1000);
  animate();
}

function setupLighting() {
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xffeb3b, 1.2);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  // Memperluas area tangkapan bayangan agar tidak terpotong
  const d = 200; // Radius area bayangan (sesuaikan dengan MAP_RADIUS_COLLISION)
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.bias = -0.0005; // Mengurangi artifact garis-garis pada bayangan
  // ------------------------------------

  scene.add(sunLight);

  const vertexShader = `varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4( position, 1.0 ); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
  const fragmentShader = `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize( vWorldPosition + offset ).y; gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 ); }`;
  const uniforms = {
    topColor: { value: new THREE.Color(0x0077ff) },
    bottomColor: { value: new THREE.Color(0xffffff) },
    offset: { value: 33 },
    exponent: { value: 0.6 },
  };
  const skyGeo = new THREE.SphereGeometry(400, 32, 15);
  skyMesh = new THREE.Mesh(
    skyGeo,
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.BackSide,
    })
  );
  scene.add(skyMesh);
}

function createEnvironment() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(350, 350),
    new THREE.MeshPhongMaterial({ color: 0x2d4a22 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  groundMesh = ground; // simpan referensi global - dipakai applyLevelTheme() ganti warna
  const circleGeo = new THREE.CircleGeometry(9, 32);
  shopArea = new THREE.Mesh(
    circleGeo,
    new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.2,
    })
  );
  shopArea.rotation.x = -Math.PI / 2;
  shopArea.position.set(25, 0.05, -15);
  scene.add(shopArea);
  homeArea = new THREE.Mesh(
    circleGeo,
    new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.2,
    })
  );
  homeArea.rotation.x = -Math.PI / 2;
  homeArea.position.set(-25, 0.05, -15);
  scene.add(homeArea);
}

// --- TEMA MAP PER LEVEL ---
// Cuma reskin ambient (warna tanah + prop dekorasi) - trees/oreRocks/shop/home
// tetap SAMA di semua level (progress kebawa semua, sesuai keputusan user).
// ponytail: prop dikasih warna FLAT hasil override THREE.js (bukan texture asli
// kit Kenney-nya) - kit itu butuh colormap.png eksternal dirujuk path relatif di
// dalam GLB, ribet buat di-colocate persis per prop. Cukup silhouette + tint,
// upgrade ke texture asli kalau user minta lebih detail nanti.
const LEVEL_THEMES = {
  1: { name: "Hutan", groundColor: 0x2d4a22, props: [] },
  2: {
    name: "Kuburan",
    groundColor: 0x3a3a35,
    props: [
      { asset: "assets/graveyard/gravestone-bevel.glb", count: 8, scale: 2.5, color: 0x9a9a9a },
      { asset: "assets/graveyard/gravestone-cross.glb", count: 6, scale: 2.5, color: 0xa8a8a0 },
      { asset: "assets/graveyard/iron-fence.glb", count: 10, scale: 2.5, color: 0x2f2f2f },
      { asset: "assets/graveyard/crypt-small.glb", count: 2, scale: 3, color: 0x6b6b6b },
    ],
  },
  3: {
    name: "Bajak Laut",
    groundColor: 0xc2b280,
    props: [
      { asset: "assets/pirate/palm-detailed-straight.glb", count: 8, scale: 3, color: 0x4a7c3f },
      { asset: "assets/pirate/ship-wreck.glb", count: 1, scale: 4, color: 0x7a6a52 },
      { asset: "assets/pirate/chest.glb", count: 3, scale: 2.5, color: 0x8b5a2b },
      { asset: "assets/pirate/barrel.glb", count: 5, scale: 2.5, color: 0x6b4423 },
    ],
  },
  4: {
    name: "Pasar",
    groundColor: 0x8a8a8a,
    props: [
      { asset: "assets/market/shelf-boxes.glb", count: 6, scale: 2.5, color: 0xc97a3d },
      { asset: "assets/market/cash-register.glb", count: 2, scale: 2.5, color: 0x555555 },
      { asset: "assets/market/shopping-cart.glb", count: 4, scale: 2.5, color: 0xb0b0b0 },
    ],
  },
};

function applyLevelTheme(levelNum) {
  const theme = LEVEL_THEMES[levelNum] || LEVEL_THEMES[1];

  if (groundMesh) groundMesh.material.color.setHex(theme.groundColor);

  // Bersihkan prop tema level SEBELUMNYA dulu
  themeDecor.forEach((d) => scene.remove(d));
  themeDecor = [];

  (theme.props || []).forEach((propCfg) => {
    loader.load(propCfg.asset, (gltf) => {
      for (let i = 0; i < propCfg.count; i++) {
        const prop = gltf.scene.clone();
        prop.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone(); // biar tint gak ikut ngerubah instance lain
            if (propCfg.color) o.material.color.setHex(propCfg.color);
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        const pos = randomDecorPosition();
        if (!pos) continue;
        prop.position.set(pos.x, 0, pos.z);
        prop.rotation.y = Math.random() * Math.PI * 2;
        const s = propCfg.scale || 2.5;
        prop.scale.set(s, s, s);
        scene.add(prop);
        themeDecor.push(prop);
      }
    });
  });
}

// Posisi acak buat dekorasi (rumput/batu hias) - jauhi toko & rumah biar gak numbuh
// nembus bangunan. Null kalau gagal ketemu titik valid (dilewatin, gapapa - cuma dekorasi).
function randomDecorPosition() {
  const BUILDING_MARGIN = 15; // shopArea/homeArea radius 9, margin biar ada jarak aman
  for (let tries = 0; tries < 10; tries++) {
    const dist = Math.random() * MAP_RADIUS_COLLISION;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (shopArea && Math.hypot(x - shopArea.position.x, z - shopArea.position.z) < BUILDING_MARGIN)
      continue;
    if (homeArea && Math.hypot(x - homeArea.position.x, z - homeArea.position.z) < BUILDING_MARGIN)
      continue;
    if (Math.hypot(x - STORE2_POS.x, z - STORE2_POS.z) < BUILDING_MARGIN) continue; // toko kedua
    return { x, z };
  }
  return null;
}

function spawnOneOreRock(type) {
  if (oreRockModels.length < 2) return;
  const conf = ORE_TYPES[type];
  const model = oreRockModels[Math.floor(Math.random() * oreRockModels.length)];
  const rock = model.clone();
  rock.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone(); // biar tint warna gak ikut ngerubah batu hiasan
      o.material.color.setHex(conf.color);
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  let tx, tz, tries = 0, valid = false;
  while (!valid && tries < 30) {
    tries++;
    tx = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
    tz = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
    const posVec = new THREE.Vector3(tx, 0, tz);
    if (posVec.length() < 35) continue;
    if (posVec.length() > MAP_RADIUS_COLLISION) continue; // jangan sampe nembus ring bukit
    if (posVec.distanceTo(shopArea.position) < 20) continue;
    if (posVec.distanceTo(homeArea.position) < 20) continue;
    if (Math.hypot(tx - STORE2_POS.x, tz - STORE2_POS.z) < 15) continue; // toko kedua
    valid = true;
  }
  if (!valid) return;

  // ~8% batu langka - kilau emisif + reward 3x, biar ada variasi kejutan pas
  // main (dulu semua batu sama rata, gak ada alasan buru-buru nyariin yang mana).
  const isRare = Math.random() < 0.08;
  if (isRare) {
    rock.traverse((o) => {
      if (o.isMesh && o.material && "emissive" in o.material) {
        o.material.emissive = new THREE.Color(0xffee88);
        o.material.emissiveIntensity = 0.8;
      }
    });
    rock.scale.set(5, 5, 5);
  } else {
    rock.scale.set(4, 4, 4);
  }
  rock.position.set(tx, 0, tz);
  rock.rotation.y = Math.random() * Math.PI * 2;
  rock.userData = {
    oreType: type,
    hp: conf.hp * Math.max(1, state.pickaxeLevel), // scaling sama pola kayak pohon (axeLevel) - min 1 biar gak 0-HP sebelum pickaxe kebeli
    maxHp: conf.hp * Math.max(1, state.pickaxeLevel),
    reward: isRare ? conf.reward * 3 : conf.reward,
    isRare: isRare,
    collisionRadius: 2.0,
    interactionRadius: 3.5,
  };
  scene.add(rock);
  oreRocks.push(rock);
}

function spawnInitialOreRocks() {
  for (let i = 0; i < 8; i++) spawnOneOreRock("gold");
  for (let i = 0; i < 10; i++) spawnOneOreRock("coal");
}

function spawnInitialTrees() {
  for (let i = 0; i < 45; i++) {
    spawnOneTree();
  }
}

// GANTI FUNCTION spawnOneTree SEPENUHNYA
function spawnOneTree() {
  const rand = Math.random();
  let model, conf;

  // KONFIGURASI 3 JENIS POHON
  if (rand < 0.33) {
    // TIPE 1: KECIL (60%)
    model = treeModels.type1;
    conf = {
      scale: 3.8,
      hp: 3,
      reward: 2,
      colRad: 2.5, // Badan nabrak di jarak 2.5
      interactRad: 3.5, // Tombol muncul di jarak 5.5
      gap: 5,
    };
  } else if (rand < 0.66) {
    // TIPE 2: SEDANG (30%)
    model = treeModels.type2;
    conf = {
      scale: 5.0,
      hp: 6,
      reward: 5,
      colRad: 3.5, // Badan nabrak di jarak 4.0
      interactRad: 4.0, // Tombol muncul di jarak 7.5
      gap: 8,
    };
  } else {
    // TIPE 3: BESAR (10%)
    model = treeModels.type3;
    conf = {
      scale: 7.5,
      hp: 15,
      reward: 15,
      colRad: 1.5, // Badan nabrak di jarak 6.0
      interactRad: 2.5, // Tombol muncul di jarak 11.0 (Jauh)
      gap: 12,
    };
  }

  if (!model) return;

  const tree = model.clone();
  let tx,
    tz,
    validPos = false,
    attempts = 0;

  while (!validPos && attempts < 100) {
    attempts++;
    tx = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
    tz = (Math.random() - 0.5) * (MAP_RADIUS_COLLISION * 1.6);
    const posVec = new THREE.Vector3(tx, 0, tz);

    if (posVec.length() < 35) continue;
    if (posVec.length() > MAP_RADIUS_COLLISION) continue; // jangan sampe nembus ring bukit
    if (posVec.distanceTo(shopArea.position) < 25) continue;
    if (posVec.distanceTo(homeArea.position) < 25) continue;
    if (Math.hypot(tx - STORE2_POS.x, tz - STORE2_POS.z) < 15) continue; // toko kedua
    if (player && posVec.distanceTo(player.position) < 8.0) continue;

    let tooClose = false;
    for (let t of trees) {
      if (posVec.distanceTo(t.position) < conf.gap) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) validPos = true;
  }

  if (validPos) {
    // ~8% pohon langka - reward 3x + kilau emisif. Material HARUS di-clone dulu
    // (kayak pola di spawnOneOreRock) - .clone() Object3D gak clone material,
    // jadi tanpa ini nyalain emissive di 1 pohon bakal nyalain SEMUA pohon
    // model yang sama (material-nya di-share antar instance).
    const isRare = Math.random() < 0.08;
    if (isRare) {
      tree.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          if ("emissive" in o.material) {
            o.material.emissive = new THREE.Color(0xffee88);
            o.material.emissiveIntensity = 0.7;
          }
        }
      });
    }

    tree.position.set(tx, 0, tz);
    tree.scale.set(
      isRare ? conf.scale * 1.15 : conf.scale,
      isRare ? conf.scale * 1.15 : conf.scale,
      isRare ? conf.scale * 1.15 : conf.scale
    );
    tree.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // SIMPAN DATA PENTING KE POHON
    tree.userData = {
      hp: conf.hp * state.axeLevel,
      maxHp: conf.hp * state.axeLevel,
      reward: isRare ? conf.reward * 3 : conf.reward,
      isRare: isRare,
      collisionRadius: conf.colRad,
      interactionRadius: conf.interactRad, // <-- INI KUNCI JARAK TOMBOL
    };

    scene.add(tree);
    trees.push(tree);
  }
}

// --- FUNGSI HELPER BARU UNTUK SMOOTH ANIMATION ---
function fadeAnimation(newAction, duration = 0.2) {
  if (!newAction || !gameStarted || isPaused) return;
  if (newAction === activeAction) return; // Animasi sama, abaikan

  const oldAction = activeAction;
  newAction.reset();
  newAction.play();
  newAction.setEffectiveTimeScale(1);
  newAction.setEffectiveWeight(1);

  if (oldAction) {
    // Lakukan blending smooth
    oldAction.crossFadeTo(newAction, duration, true);
  } else {
    newAction.fadeIn(duration);
  }

  activeAction = newAction;
}

function update(delta) {
  if (isPaused) return;
  if (!player) return;
  if (mixer) mixer.update(delta);
  if (employeeMixer) employeeMixer.update(delta);

  // Blend lengan kiri ke pose "pegang barang" biar kapak kelihatan digenggam,
  // bukan cuma nempel diam. Skip saat nebang - biar animasi ayun kapak (Chop) murni.
  if (leftArmBone && armHoldQuat && !state.isChopping) {
    leftArmBone.quaternion.slerp(armHoldQuat, 0.9);
  }

  // --- 1. LOGIKA LOMPAT & GRAVITASI (TETAP) ---
  if (isJumping || player.position.y > 0) {
    player.position.y += yVelocity;
    yVelocity -= GRAVITY;
    const stretch = 1 + yVelocity * 0.5;
    const squash = 1 / Math.sqrt(stretch > 0 ? stretch : 1);
    player.scale.y = THREE.MathUtils.lerp(
      player.scale.y,
      Math.max(0.8, Math.min(2.0, stretch)) * 1.5,
      0.2
    );
    player.scale.x = THREE.MathUtils.lerp(player.scale.x, squash * 1.5, 0.2);
    player.scale.z = THREE.MathUtils.lerp(player.scale.z, squash * 1.5, 0.2);
    if (player.position.y <= 0) {
      player.position.y = 0;
      isJumping = false;
      yVelocity = 0;
      player.scale.set(1.5, 1.5, 1.5);
      createDust(player.position);
    }
  }

  // --- 2. INPUT (TETAP) ---
  let dx = joystick.x,
    dz = joystick.y;
  if (keys.ArrowUp) dz -= 1;
  if (keys.ArrowDown) dz += 1;
  if (keys.ArrowLeft) dx -= 1;
  if (keys.ArrowRight) dx += 1;
  if (keys.Space) jump();
  if (keys.Shift) toggleRun(true);
  else if (!("ontouchstart" in window)) toggleRun(false);

  // --- 3. LOGIKA GERAK, STAMINA & AUDIO (FIXED SMOOTH JUMP & MOVEMENT) ---
  const isMoving = Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1;
  let currentSpeed = WALK_SPEED;

  const walkAudio = document.getElementById("sfx-step");
  const runAudio = document.getElementById("sfx-run");

  // LOGIKA PRIORITAS ANIMASI & BLENDING (UPDATED)
  if (state.isChopping) {
    // Animasi nebang sedang berjalan, logic Gerak/Lompat di-freeze oleh fungsi performChop.
    // Kita tidak melakukan blending animasi di sini, biarkan nebang selesai.
  } else if (isJumping) {
    // Prioritas 1: Sedang Loncat (Jalan/Lari tetap di blok ini)

    // Mainkan animasi loncat dengan blending smooth jika sebelumnya dari gerakan lain
    if (actions["Jump"]) fadeAnimation(actions["Jump"], 0.1); // Blending sangat cepat agar responsif

    if (isMoving) {
      // Loncat sambil bergerak
      currentSpeed = WALK_SPEED; // Gunakan kecepatan jalan saat loncat agar tidak "peyot"

      // Logic Audio (Matikan langkah saat di udara)
      if (walkAudio) walkAudio.pause();
      if (runAudio) runAudio.pause();

      // Timer auto-save tetap jalan jika loncat sambil maju
      autoSaveTimer += delta;
      if (autoSaveTimer > 1.0) {
        saveGame();
        autoSaveTimer = 0;
      }
    } else {
      // Loncat di tempat
      autoSaveTimer = 0;
    }
  } else if (isMoving) {
    // Prioritas 2: Sedang Bergerak di Tanah (TETAP SAMA LOGIKANYA, HANYA ANIMASI SMOOTH)

    // Cek apakah Lari
    if (isRunning && state.stamina > 0) {
      // MODE LARI
      currentSpeed = RUN_SPEED;
      state.stamina -= 1 * delta; // Kurangi stamina
      staminaRegenTimer = 2.0; // Tunda regen

      // --- FIX BUG LARI MIRING (DIHAPUS player.rotation.x = 0.2) ---
      // player.rotation.x = 0.2; // Hapus condong ke depan

      // Smooth Animation (Mulai blend ke lari)
      if (actions["Run"]) {
        fadeAnimation(actions["Run"], 0.2);
        actions["Run"].timeScale = 2.0; // Animasi cepat
      }

      if (Math.random() < 0.1) createDust(player.position);

      // Logic Audio Lari
      if (!isSFXMuted) {
        if (walkAudio && !walkAudio.paused) walkAudio.pause();
        if (runAudio && runAudio.paused) runAudio.play().catch(() => {});
      } else {
        if (walkAudio) walkAudio.pause();
        if (runAudio) runAudio.pause();
      }
    } else {
      // MODE JALAN BIASA (Atau habis stamina)
      if (isRunning && state.stamina <= 0) {
        isRunning = false;
        showToast("Lelah... Butuh istirahat!", "error");
      }
      currentSpeed = WALK_SPEED;

      // Smooth Animation (Mulai blend ke lari, tapi timeScale normal)
      if (actions["Run"]) {
        fadeAnimation(actions["Run"], 0.2);
        actions["Run"].timeScale = 1.0; // Animasi jalan normal
      }
      player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0, 0.2); // Badan tegak perlahan

      // Logic Audio Jalan
      if (!isSFXMuted) {
        if (runAudio && !runAudio.paused) runAudio.pause();
        if (walkAudio && walkAudio.paused) walkAudio.play().catch(() => {});
      } else {
        if (walkAudio) walkAudio.pause();
        if (runAudio) runAudio.pause();
      }
    }

    // Auto Save saat bergerak
    autoSaveTimer += delta;
    if (autoSaveTimer > 1.0) {
      saveGame();
      autoSaveTimer = 0;
    }
  } else {
    // Prioritas 3: Diam di Tanah

    // Smooth Animation (Mulai blend ke Idle)
    if (actions["Idle"]) {
      fadeAnimation(actions["Idle"], 0.3); // Blending agak lambat agar smooth ke diam
      if (actions["Run"]) actions["Run"].timeScale = 1.0;
    }
    player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0, 0.2); // Badan tegak perlahan

    // Matikan Suara Langkah
    if (walkAudio && !walkAudio.paused) {
      walkAudio.pause();
      walkAudio.currentTime = 0;
    }
    if (runAudio && !runAudio.paused) {
      runAudio.pause();
      runAudio.currentTime = 0;
    }

    autoSaveTimer = 0;

    // Regen Stamina
    if (staminaRegenTimer > 0) staminaRegenTimer -= delta;
    else if (state.stamina < state.maxStamina) state.stamina += 5 * delta;
  }

  // Batas Stamina (TETAP)
  if (state.stamina < 0) state.stamina = 0;
  if (state.stamina > state.maxStamina) state.stamina = state.maxStamina;
  updateStaminaUI();

  // --- 4. PERHITUNGAN POSISI & TABRAKAN (FIXED SMOOTH ROTATION Y) ---
  const speed = currentSpeed * delta;
  if (!state.isChopping) {
    if (isMoving) {
      const inputAngle = Math.atan2(dx, dz);
      const targetAngle = inputAngle + cameraAngle;

      const nextX = player.position.x + Math.sin(targetAngle) * speed;
      const nextZ = player.position.z + Math.cos(targetAngle) * speed;

      let angleDiff = targetAngle - player.rotation.y;

      // Normalisasi selisih agar selalu antara -PI dan +PI
      // Ini memaksa karakter memilih putaran terdekat (kiri atau kanan)
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Terapkan rotasi halus berdasarkan selisih terpendek
      player.rotation.y += angleDiff * 0.15; // 0.15 adalah kecepatan putar (semakin besar semakin cepat)
      const distFromCenter = Math.sqrt(nextX * nextX + nextZ * nextZ);
      // ponytail: dulu kalau kena batas, posisi di-SNAP ulang pakai atan2(nextZ,nextX)
      // tiap frame - sudut itu ngikutin noise kecil joystick sentuh, dan dikali radius
      // gede (137) jadi lompatan posisi kelihatan kayak gempa/goyang. Sekarang tinggal
      // diam di tempat kalau ketabrak batas, sama persis kayak nabrak pohon/batu biasa.
      if (distFromCenter < MAP_RADIUS_COLLISION && !checkCollision(nextX, nextZ)) {
        player.position.x = nextX;
        player.position.z = nextZ;
      }
      // Animasi sudah di-handle di blok prioritasi di atas.
    } else {
      // Animasi sudah di-handle di blok prioritasi di atas.
    }
  }

  // --- 5. KAMERA (TETAP) ---
  // ... (Kamera logic tetap sama) ...
  const isLandscape = window.innerWidth > window.innerHeight;
  const baseDist = isLandscape ? 10 : 16;
  const baseHeight = isLandscape ? 8 : 14;
  // ponytail: batas dihitung dari totalHeight (bukan cameraPitch mentah) biar rentang
  // "naik-turun" kamera SAMA di potret & landscape - sebelumnya minPitch beda tiap
  // orientasi (turunan dari baseHeight), jadi pas HP diputar sudut lama tiba-tiba
  // ke-clamp aneh/mentok. Sekarang totalHeight selalu dibatasi 3..30 di kedua mode.
  const minPitch = 3 - baseHeight;
  const maxPitch = 30 - baseHeight;
  cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
  const totalHeight = baseHeight + cameraPitch;

  // Auto-follow: kamera nempel di belakang karakter SELAMA jalan LURUS ke depan
  // (relatif kamera). Belok/strafe/diagonal = kamera dibiarkan diam, gak dipaksa ngejar.
  // ponytail: kenapa gak "selalu ngejar pas gerak" - targetAngle = inputAngle + cameraAngle,
  // jadi kalau cameraAngle ikut dikejar ke player.rotation.y SEMENTARA inputAngle
  // (arah joystick, gak tergantung cameraAngle) dipegang tetap di sudut manapun selain
  // 0, sistemnya gak punya titik seimbang - dibuktikan pakai analisis eigenvalue:
  // salah satu mode punya λ=1 (netral) + gaya dorong dari inputAngle -> muter TANPA
  // BATAS selama joystick dipegang miring, gak peduli seberapa lambat rate-nya. Itu
  // penyebab asli "muter-muter ga jelas" pas jalan. Fix: cuma kejar kalau inputAngle
  // dekat 0 (jalan lurus ke depan relatif kamera saat ini) - di situ gaya dorongnya
  // ~0 jadi stabil beneran, dan pas belok kamera cuma diam (gak ada spin sama sekali).
  const inputAngle = Math.atan2(dx, dz);
  cameraIdleTimer += delta;
  if (
    isMoving &&
    !isRotating &&
    cameraIdleTimer > 0.15 &&
    Math.abs(inputAngle) < 0.3
  ) {
    let camDiff = player.rotation.y - cameraAngle;
    while (camDiff > Math.PI) camDiff -= Math.PI * 2;
    while (camDiff < -Math.PI) camDiff += Math.PI * 2;
    cameraAngle += camDiff * 0.2;
  }
  const offsetX = Math.sin(cameraAngle) * baseDist * cameraZoom;
  const offsetZ = Math.cos(cameraAngle) * baseDist * cameraZoom;
  const offsetY = totalHeight * cameraZoom;
  // ponytail: kamera nempel di tinggi tanah (bukan player.position.y) biar lompatan
  // kelihatan karakternya yang naik, bukan kamera/tanah ikut naik menutupi lompatan.
  const camTarget = new THREE.Vector3(
    player.position.x + offsetX,
    offsetY,
    player.position.z + offsetZ
  );
  camera.position.lerp(camTarget, 0.08);
  camera.lookAt(player.position.x, 0, player.position.z);

  // === MENGEMBALIKAN FITUR SEMBUNYI DI RUMPUT ===
  let isHiding = false;
  // Pastikan array grasses ada isinya
  if (typeof grasses !== "undefined" && grasses.length > 0) {
    for (let g of grasses) {
      // Jarak deteksi sembunyi
      if (player.position.distanceTo(g.position) < 1.5) {
        isHiding = true;
        break;
      }
    }
  }

  // Efek Transparan pada Player
  player.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.transparent = true;
      // Jika sembunyi opacity 0.5, jika tidak 1.0
      const targetOp = isHiding ? 0.5 : 1.0;
      // Gunakan lerp agar perubahan transparansi halus
      child.material.opacity = THREE.MathUtils.lerp(
        child.material.opacity,
        targetOp,
        0.1
      );
    }
  });
  // ==============================================

  // --- 6. UPDATE LAIN (TETAP) ---
  checkInteractions();
  updateMinimap();
  updateTreeHPBar();
  updateHomeInfoBubble();
  updateEmployeeChat();
}

function checkCollision(nextX, nextZ) {
  const distShop = Math.sqrt(
    (nextX - shopArea.position.x) ** 2 + (nextZ - shopArea.position.z) ** 2
  );
  if (distShop < COLLISION_RADII.shop) return true;
  const distHome = Math.sqrt(
    (nextX - homeArea.position.x) ** 2 + (nextZ - homeArea.position.z) ** 2
  );
  if (distHome < COLLISION_RADII.home) return true;

  for (let t of trees) {
    // Ambil radius dinamis dari pohon
    const radius = t.userData.collisionRadius || 2.5;
    const distTree = Math.sqrt(
      (nextX - t.position.x) ** 2 + (nextZ - t.position.z) ** 2
    );

    if (distTree < radius) return true;
  }

  // Batu hiasan & batu tambang sekarang bisa DILOMPATI (skip blokir pas isJumping) -
  // tetap solid kalau jalan biasa gak lompat. Pohon/toko/rumah TETAP solid walau
  // lompat (badan lebih gede dari batu).
  if (!isJumping) {
    for (let r of rocks) {
      const radius = r.userData.collisionRadius || 2.0;
      const distRock = Math.sqrt(
        (nextX - r.position.x) ** 2 + (nextZ - r.position.z) ** 2
      );
      if (distRock < radius) return true;
    }

    for (let o of oreRocks) {
      if (o.userData.hp <= 0) continue;
      const radius = o.userData.collisionRadius || 2.0;
      const distOre = Math.sqrt(
        (nextX - o.position.x) ** 2 + (nextZ - o.position.z) ** 2
      );
      if (distOre < radius) return true;
    }
  }
  return false;
}

function toggleRun(isPressed) {
  if (isPressed) {
    if (state.stamina > 0) isRunning = true;
    else showToast("Terlalu Lelah!", "error");
  } else {
    isRunning = false;
  }

  const btn = document.getElementById("run-btn");
  if (isRunning) {
    btn.classList.add("active");
    // HAPUS baris play audio disini
  } else {
    btn.classList.remove("active");
    // HAPUS baris pause audio disini
  }
}

function createDust(pos) {
  const count = 3;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + (Math.random() - 0.5),
      pos.y,
      pos.z + (Math.random() - 0.5)
    );
    scene.add(mesh);
    let s = 1;
    const anim = () => {
      s -= 0.05;
      mesh.scale.set(s, s, s);
      mesh.position.y += 0.05;
      mesh.rotation.x += 0.1;
      if (s > 0) requestAnimationFrame(anim);
      else scene.remove(mesh);
    };
    anim();
  }
}

function jump() {
  if (player && !isJumping) {
    // --- TAMBAHAN: Cek & Kurangi Stamina ---
    if (state.stamina < 1) {
      showToast("Terlalu Lelah untuk Loncat!", "error");
      return; // Batalkan loncat
    }

    state.stamina -= 1; // Kurangi 1 energi
    updateStaminaUI(); // Update tampilan bar
    // ----------------------------------------

    isJumping = true;
    yVelocity = 0.8;

    // Animasi Jump
    if (actions["Jump"]) {
      actions["Jump"].reset().setLoop(THREE.LoopOnce).play();
      activeAction = actions["Jump"];
    }

    playSound("sfx-jump");
  }
}

function checkInteractions() {
  if (!player) return;

  // 1. Cek Interaksi Pohon
  let foundTree = null;

  for (let t of trees) {
    if (t.userData.hp <= 0) continue;

    const dist = player.position.distanceTo(t.position);

    // PERBAIKAN: Gunakan radius interaksi spesifik dari userData pohon tersebut
    // Jika tidak ada, fallback ke radius standar
    const interactDist = t.userData.interactionRadius || 4.0;

    if (dist < interactDist) {
      // Hitung Sudut Hadap (Dot Product)
      const playerDirX = Math.sin(player.rotation.y);
      const playerDirZ = Math.cos(player.rotation.y);
      const toTreeX = t.position.x - player.position.x;
      const toTreeZ = t.position.z - player.position.z;

      const normTreeX = toTreeX / dist;
      const normTreeZ = toTreeZ / dist;
      const dotProduct = playerDirX * normTreeX + playerDirZ * normTreeZ;

      // Toleransi sudut (semakin kecil angka, semakin lebar sudut deteksinya)
      // 0.0 = 180 derajat (depan karakter)
      if (dotProduct > 0.7) {
        foundTree = t;
        break;
      }
    }
  }

  state.nearTree = foundTree;

  // 1b. Cek Interaksi Batu Tambang (pola sama kayak pohon, tanpa cek sudut hadap)
  let foundOre = null;
  for (let o of oreRocks) {
    if (o.userData.hp <= 0) continue;
    const dist = player.position.distanceTo(o.position);
    if (dist < (o.userData.interactionRadius || 3.5)) {
      foundOre = o;
      break;
    }
  }
  state.nearOre = foundOre;

  // 2. LOGIKA TOMBOL (DIPERBAIKI ID-NYA)
  const actionBtn = document.getElementById("action-btn");
  const shopBtn = document.getElementById("btn-shop"); // Pastikan ID ini ada di HTML jika dipakai
  const sleepBtn = document.getElementById("btn-sleep"); // Pastikan ID ini ada di HTML jika dipakai

  if (actionBtn) {
    // Reset state tombol
    let showAction = false;
    let icon = "";
    let actionFunc = null;

    // Icon aksi nebang/nambang sekarang ikut ALAT YANG DIPEGANG (bukan target
    // pohon/batu) - jujur nunjukkin apa yang bakal diayun, konsisten sama syarat
    // "alat harus cocok" di performChop()/performMine(). FontAwesome free gak
    // punya icon pickaxe asli, martil (fa-hammer) paling mendekati.
    const toolIcon =
      equippedTool === "axe"
        ? '<span style="font-size: 28px; line-height: 1;">🪓</span>'
        : '<i class="fa-solid fa-hammer"></i>';

    // Prioritas 1: Toko
    const distShop = player.position.distanceTo(shopArea.position);
    if (distShop < INTERACTION_RADII.shop) {
      state.nearShop = true;
      showAction = true;
      icon = '<i class="fa-solid fa-cart-shopping"></i>'; // Icon Toko
      actionFunc = openShop;
    } else {
      state.nearShop = false;
    }

    // Prioritas 1b: Papan Misi (toko kedua - dulu cuma dekorasi, sekarang jadi
    // fungsional). Dicek terpisah dari toko utama biar gak numpuk 1 tombol.
    const distStore2 = Math.hypot(
      player.position.x - STORE2_POS.x,
      player.position.z - STORE2_POS.z
    );
    if (!showAction && distStore2 < 12.0) {
      showAction = true;
      icon = '<i class="fa-solid fa-scroll"></i>'; // Icon Misi
      actionFunc = openQuestBoard;
    }

    // Prioritas 2: Pohon (Jika tidak dekat toko/misi)
    if (!showAction && state.nearTree) {
      showAction = true;
      icon = toolIcon;
      actionFunc = () => performChop(state.nearTree);
    }

    // Prioritas 3: Batu Tambang (Jika tidak dekat toko/misi/pohon)
    if (!showAction && state.nearOre) {
      showAction = true;
      icon = toolIcon;
      actionFunc = () => performMine(state.nearOre);
    }

    // ponytail: dulu alat di tangan ganti OTOMATIS sesuai target terdekat - tapi
    // itu bikin syarat "kapak buat pohon, pickaxe buat batu" gak pernah kepakai
    // (alatnya selalu otomatis benar). Sekarang alat cuma ganti lewat tombol
    // manual (toggleWeapon) - lihat performChop()/performMine() buat gerbang
    // pengecekannya, dan updateTreeHPBar() buat keterangan di atas bar darah.

    // Terapkan ke tombol
    if (showAction) {
      actionBtn.classList.remove("hidden");
      actionBtn.style.transform = "scale(1)";

      actionBtn.innerHTML = icon;
      actionBtn.onclick = actionFunc;
    } else {
      // Cek interaksi rumah terpisah karena tombolnya beda (btn-sleep)
      actionBtn.classList.add("hidden");
    }
  }

  // 3. Cek Interaksi Rumah (Tombol Tidur Terpisah)
  if (sleepBtn) {
    const distHome = player.position.distanceTo(homeArea.position);
    if (distHome < INTERACTION_RADII.home) {
      sleepBtn.classList.remove("hidden");
    } else {
      sleepBtn.classList.add("hidden");
    }
  }
}

function handleAction() {
  if (state.nearShop) openShop();
  else if (state.nearTree && !state.isChopping) performChop(state.nearTree);
  else if (state.nearOre && !state.isChopping) performMine(state.nearOre);
}

// Biaya stamina per target - dipakai performChop/performMine DAN label energi di
// updateTreeHPBar(), biar satu sumber angka (dulu duplikat inline, gampang beda).
function getStaminaCost(target) {
  if (target.userData.oreType) return 4; // tambang (gold/coal sama)
  if (target.userData.maxHp >= 15) return 8; // Pohon Besar
  if (target.userData.maxHp >= 6) return 5; // Pohon Sedang
  return 3; // Pohon Kecil
}

function performChop(tree) {
  // Guard klik cepat: dulu cuma dicek di handleAction(), tapi actionBtn.onclick di
  // checkInteractions() manggil performChop() langsung (skip handleAction), jadi spam
  // klik tombol bisa numpuk animasi/damage/stamina berkali-kali dalam 1 ayunan.
  if (state.isChopping) return;

  // Pohon cuma bisa ditebang pakai kapak - ganti alat lewat tombol ganti senjata.
  if (equippedTool !== "axe") {
    showToast("Butuh Kapak buat nebang pohon!", "error");
    return;
  }

  const staminaCost = getStaminaCost(tree);

  // Cek stamina
  if (state.stamina < staminaCost) {
    showToast("Terlalu Lelah!", "error");
    return;
  }

  // Kurangi stamina & Mainkan suara kapak
  staminaRegenTimer = 2.0;
  state.stamina -= staminaCost;
  updateStaminaUI();
  state.isChopping = true;
  playSound("sfx-chop");

  // Animasi mengayun kapak asli dari model (attack-melee-left), bukan spin badan.
  if (actions["Chop"]) {
    fadeAnimation(actions["Chop"], 0.05); // reset()+play() sudah dihandle di dalam fadeAnimation
    setTimeout(onChopFinish, actions["Chop"].getClip().duration * 1000);
  } else {
    setTimeout(onChopFinish, 330); // fallback kalau model gak punya klip ini
  }

  function onChopFinish() {
    state.isChopping = false;
    showDamage(tree.position, state.axeDamage);
    tree.userData.hp -= state.axeDamage;
    tree.rotation.z = 0.15;
    setTimeout(() => (tree.rotation.z = 0), 100);

    if (tree.userData.hp <= 0) {
      // POHON TUMBANG
      scene.remove(tree);
      trees = trees.filter((t) => t !== tree);

      const reward = tree.userData.reward || 2;
      state.wood += reward;
      if (tree.userData.isRare) showToast(`✨ Pohon Langka! +${reward} Kayu`, "success");
      else showToast(`+${reward} Kayu`, "success");

      updateHUD();
      state.nearTree = null;

      // Save game otomatis setelah menebang
      saveGame();

      // --- PERBAIKAN SFX POHON TUMBANG ---
      const fallAudio = document.getElementById("sfx-fall");
      if (fallAudio) {
        // Reset waktu agar bisa dimainkan berulang dengan cepat
        fallAudio.currentTime = 0;
        // Pastikan volume mengikuti slider
        fallAudio.volume = document.getElementById("sfx-slider").value || 1.0;
        // Force Play dengan handling error promise
        const playPromise = fallAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Audio sfx-fall dicegah browser:", error);
          });
        }
      }
      // -----------------------------------

      setTimeout(spawnOneTree, 2000);
    }
  }
}

function performMine(ore) {
  // Guard sama kayak performChop() - cegah spam klik numpuk animasi/damage.
  if (state.isChopping) return;

  // Sekarang wajib punya pickaxe (dibeli di toko) - dulu bisa nambang pakai kapak aja.
  if (state.pickaxeLevel < 1) {
    showToast("Beli Pickaxe dulu di toko!", "error");
    return;
  }

  // Batu tambang cuma bisa ditambang pakai pickaxe - ganti alat lewat tombol ganti senjata.
  if (equippedTool !== "pickaxe") {
    showToast("Butuh Pickaxe buat nambang batu!", "error");
    return;
  }

  const staminaCost = getStaminaCost(ore);
  if (state.stamina < staminaCost) {
    showToast("Terlalu Lelah!", "error");
    return;
  }

  staminaRegenTimer = 2.0;
  state.stamina -= staminaCost;
  updateStaminaUI();
  state.isChopping = true; // reuse flag yang sama (nge-freeze gerak selama animasi)
  playSound("sfx-chop");

  if (actions["Chop"]) {
    fadeAnimation(actions["Chop"], 0.05);
    setTimeout(onMineFinish, actions["Chop"].getClip().duration * 1000);
  } else {
    setTimeout(onMineFinish, 330);
  }

  function onMineFinish() {
    state.isChopping = false;
    showDamage(ore.position, state.pickaxeDamage); // pakai damage PICKAXE, bukan kapak - alat sekarang terpisah
    ore.userData.hp -= state.pickaxeDamage;
    ore.rotation.z = 0.15;
    setTimeout(() => (ore.rotation.z = 0), 100);

    if (ore.userData.hp <= 0) {
      scene.remove(ore);
      oreRocks = oreRocks.filter((o) => o !== ore);

      const conf = ORE_TYPES[ore.userData.oreType];
      const reward = ore.userData.reward || 1;
      if (ore.userData.oreType === "gold") state.gold += reward;
      else state.coal += reward;
      if (ore.userData.isRare) showToast(`✨ Batu Langka! +${reward} ${conf.label}`, "success");
      else showToast(`+${reward} ${conf.label}`, "success");

      updateHUD();
      state.nearOre = null;
      saveGame();

      setTimeout(() => spawnOneOreRock(ore.userData.oreType), 2500);
    }
  }
}

function showDamage(pos, amount) {
  const el = document.createElement("div");
  el.className = "damage-text";
  el.innerText = `-${amount}`;
  const vec = pos.clone().add(new THREE.Vector3(0, 5, 0)).project(camera);
  el.style.left = (vec.x * 0.5 + 0.5) * window.innerWidth + "px";
  el.style.top = (-(vec.y * 0.5) + 0.5) * window.innerHeight + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function openShop() {
  isPaused = true; // Tambahkan ini agar aman (game berhenti saat belanja)
  document.getElementById("shop-coin-display").innerText = state.coins;
  // Update Data Teks (TETAP SAMA)
  document.getElementById("shop-stock").innerText = state.wood;
  document.getElementById("shop-stock-gold").innerText = state.gold;
  document.getElementById("shop-stock-coal").innerText = state.coal;
  refreshSellInputs();
  document.getElementById("axe-lvl").innerText = state.axeLevel;
  document.getElementById("axe-dmg").innerText = state.axeDamage;
  document.getElementById("max-stamina-disp").innerText = state.maxStamina;
  document.getElementById("axe-lvl-next").innerText = state.axeLevel + 1;
  document.getElementById("axe-dmg-next").innerText = state.axeDamage + 1;
  // Fix crash yang balik lagi: bug sama persis kayak punya pickaxe - begitu axe
  // sampai MAX, blok "TAMBAHAN LOGIKA HANDLE KAPAK MAX" di bawah ganti innerHTML
  // tombolnya jadi "UPGRADE <br> MAX" (span id="upgrade-cost" ke-hapus dari DOM).
  // Baris ini dulu langsung ambil getElementById("upgrade-cost") tanpa cek null,
  // jadi toko dibuka lagi setelah kapak MAX -> null.innerText -> error -> isPaused
  // nyangkut true -> semua tombol/joystick beku. Cek null dulu sama kayak pickaxe.
  const upgradeCostSpanEarly = document.getElementById("upgrade-cost");
  if (upgradeCostSpanEarly) {
    upgradeCostSpanEarly.innerText = state.axeLevel * 50;
  }
  document.getElementById("stamina-cost").innerText =
    100 + (state.maxStamina - 100) * 2;

  // Update Visual Kapak Sesuai Level Saat Ini (TETAP SAMA LOGIKANYA)
  const imgEl = document.getElementById("shop-axe-current-img");
  if (imgEl) {
    if (state.axeLevel === 1) imgEl.src = "assets/kapak.png";
    else if (state.axeLevel >= 2) imgEl.src = "assets/kapakup.png";
  }

  // Data teks + gambar Pickaxe (alat tambang - tool terpisah dari kapak)
  document.getElementById("pickaxe-lvl").innerText =
    state.pickaxeLevel === 0 ? "-" : state.pickaxeLevel;
  document.getElementById("pickaxe-dmg").innerText = state.pickaxeDamage;
  document.getElementById("pickaxe-lvl-next").innerText = state.pickaxeLevel + 1;
  document.getElementById("pickaxe-dmg-next").innerText = state.pickaxeDamage + 1;

  const pickaxeImgEl = document.getElementById("shop-pickaxe-current-img");
  if (pickaxeImgEl) {
    if (state.pickaxeLevel === 0) pickaxeImgEl.src = "assets/pickaxe.png";
    else if (state.pickaxeLevel === 1) pickaxeImgEl.src = "assets/pickaxe.png";
    else pickaxeImgEl.src = "assets/pickaxe-upgraded.png";
  }

  // Fix crash: elemen "pickaxe-upgrade-cost" ke-hapus dari DOM begitu pickaxe
  // sampai level MAX (innerHTML tombol diganti jadi teks polos di bawah), jadi
  // getElementById-nya WAJIB dicek null dulu sebelum dipakai (dulu langsung
  // dipakai tanpa cek -> .closest() lempar error tiap toko dibuka lagi setelah
  // pickaxe MAX -> isPaused nyangkut true -> karakter/tombol beku total).
  const pickaxeUpgradeCostSpan = document.getElementById("pickaxe-upgrade-cost");
  if (pickaxeUpgradeCostSpan) {
    pickaxeUpgradeCostSpan.innerText = (state.pickaxeLevel + 1) * 50;
  }
  const pickaxeUpgradeBtn = pickaxeUpgradeCostSpan
    ? pickaxeUpgradeCostSpan.closest("button")
    : document.getElementById("pickaxe-upgrade-btn");
  if (pickaxeUpgradeBtn) {
    if (state.pickaxeLevel >= MAX_PICKAXE_LEVEL) {
      document.getElementById("pickaxe-lvl-next").innerText = "MAX";
      document.getElementById("pickaxe-dmg-next").innerText = "MAX";
      pickaxeUpgradeBtn.innerHTML = "UPGRADE <br> MAX";
      pickaxeUpgradeBtn.disabled = true;
      pickaxeUpgradeBtn.classList.remove(
        "bg-blue-500",
        "hover:bg-blue-600",
        "active:scale-95"
      );
      pickaxeUpgradeBtn.classList.add("bg-gray-400", "cursor-not-allowed");
    } else {
      pickaxeUpgradeBtn.innerHTML = `${
        state.pickaxeLevel === 0 ? "BELI" : "UPGRADE"
      } <br><span id="pickaxe-upgrade-cost">${
        (state.pickaxeLevel + 1) * 50
      }</span><i class="fa-solid fa-coins"></i>`;
      pickaxeUpgradeBtn.disabled = false;
      pickaxeUpgradeBtn.classList.add(
        "bg-blue-500",
        "hover:bg-blue-600",
        "active:scale-95"
      );
      pickaxeUpgradeBtn.classList.remove("bg-gray-400", "cursor-not-allowed");
    }
  }

  // --- TAMBAHAN LOGIKA HANDLE KAPAK MAX (LEVEL 3) ---
  // Sama kayak pickaxe: span "upgrade-cost" bisa udah kehapus dari DOM (kalau toko
  // sempat dibuka pas axe udah MAX sebelumnya), jadi cari tombolnya lewat id stabil
  // "axe-upgrade-btn" sebagai fallback - bukan cuma lewat .closest() dari span yang
  // mungkin null.
  const upgradeCostSpan = document.getElementById("upgrade-cost");
  const upgradeBtn = upgradeCostSpan
    ? upgradeCostSpan.closest("button")
    : document.getElementById("axe-upgrade-btn");
  if (upgradeBtn) {
    // Jika sudah level maksimal
    if (state.axeLevel >= MAX_AXE_LEVEL) {
      document.getElementById("axe-lvl-next").innerText = "MAX";
      document.getElementById("axe-dmg-next").innerText = "MAX";

      upgradeBtn.innerHTML = "UPGRADE <br> MAX"; // Ikon koin & span harga hilang murni teks "MAX"
      upgradeBtn.disabled = true;
      upgradeBtn.classList.remove(
        "bg-orange-500",
        "hover:bg-orange-600",
        "active:scale-95"
      );
      upgradeBtn.classList.add("bg-gray-400", "cursor-not-allowed");
    } else {
      // Belum Max, pastikan tombol upgrade kembali normal (reset jika pernah MAX)
      upgradeBtn.innerHTML = `UPGRADE <br><span id="upgrade-cost">${
        state.axeLevel * 50
      }</span><i class="fa-solid fa-coins"></i>`;

      upgradeBtn.disabled = false;
      upgradeBtn.classList.add(
        "bg-orange-500",
        "hover:bg-orange-600",
        "active:scale-95"
      );
      upgradeBtn.classList.remove("bg-gray-400", "cursor-not-allowed");
    }
  }
  // ----------------------------------------------------

  // Buka Modal Toko
  document.getElementById("shop-modal").classList.remove("hidden");
}

function exitApp() {
  saveGame(); // Simpan dulu sebelum keluar

  // Hentikan game & semua suara total, TERLEPAS dari apakah app/tab-nya beneran
  // berhasil ketutup (di web, window.close() sering diblokir browser -> tanpa ini
  // musik & loop game tetap jalan walau user udah "konfirmasi keluar").
  isPaused = true;
  gameStarted = false;
  document.querySelectorAll("audio").forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });

  // APK Android: window.close()/about:blank TIDAK bisa nutup Activity beneran (root
  // cause bug "keluar cuma blank putih") - WebView emang gak punya API buat nutup diri
  // sendiri. Fix aslinya: MainActivity.kt pasang jembatan native (AndroidBridge.exitApp
  // -> finishAffinity()), dipanggil langsung di sini kalau ada.
  if (window.AndroidBridge && window.AndroidBridge.exitApp) {
    window.AndroidBridge.exitApp();
    return;
  }

  // Cek jika web app terinstal (standalone/TWA)
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (isStandalone || "ontouchstart" in window) {
    // Upayakan keluar jika di mobile terinstal (unreliable)
    showToast("Menutup game... Terima kasih!", "success");

    // Tunggu toast muncul sebentar
    setTimeout(() => {
      if (navigator.app && navigator.app.exitApp) {
        // Jika didukung cordova/TWA
        navigator.app.exitApp();
      } else {
        // Browser mencoba kembali (tricky di HP)
        window.close();
        // Jika di mobile browser biasa, kadang dialihkan ke home atau blank page
        setTimeout(() => {
          window.location.href = "about:blank";
        }, 100);
      }
    }, 800);
  } else {
    // Di PC Browser Biasa
    showToast("Gunakan tombol X pada browser untuk menutup tab ini.", "info");

    // Window.close hanya bekerja pada window yang dibuka oleh script.
    // Browser modern memblokir ini untuk tab utama demi keamanan.
    // Kita tetap coba, tapi beri notifikasi di PC.
    setTimeout(() => {
      window.close();
    }, 800);
  }
}

function closeShop() {
  // Panggil helper animasi tutup
  closeModalWithAnimation("shop-modal", () => {
    // Callback setelah animasi selesai:
    isPaused = false; // PENTING: Jalankan game lagi
    checkInteractions(); // PENTING: Paksa cek ulang agar tombol interaksi langsung aktif
  });
}

// --- PAPAN MISI (toko kedua - dulu cuma dekorasi, sekarang fungsional) ---
// Misi pakai ANGKA STOK yang udah ada di state (kayu/emas/batu bara/koin) - gak
// ada tracking baru, cukup cek nilai state langsung tiap render. Selesai SEMUA
// misi level ini -> tombol lanjut level muncul (lihat renderQuestList).
// Tiap misi: current() ambil angka LIVE dari state, target = angka tujuan - dipakai
// buat progress "5/10" di modal (lihat renderQuestList), bukan cuma tanda selesai/belum.
const QUESTS_PER_LEVEL = {
  1: [
    { desc: "Kumpulkan Kayu", current: () => state.wood, target: 20, reward: 30 },
    { desc: "Tambang Emas", current: () => state.gold, target: 10, reward: 50 },
    { desc: "Kumpulkan Koin", current: () => state.coins, target: 100, reward: 20 },
  ],
  2: [
    { desc: "Kumpulkan Kayu", current: () => state.wood, target: 30, reward: 40 },
    { desc: "Tambang Batu Bara", current: () => state.coal, target: 15, reward: 40 },
    { desc: "Kumpulkan Koin", current: () => state.coins, target: 250, reward: 30 },
  ],
  3: [
    { desc: "Kumpulkan Kayu", current: () => state.wood, target: 40, reward: 50 },
    { desc: "Tambang Emas", current: () => state.gold, target: 20, reward: 60 },
    { desc: "Kumpulkan Koin", current: () => state.coins, target: 400, reward: 40 },
  ],
  4: [
    { desc: "Kumpulkan Kayu", current: () => state.wood, target: 50, reward: 60 },
    { desc: "Tambang Batu Bara", current: () => state.coal, target: 25, reward: 60 },
    { desc: "Kumpulkan Koin", current: () => state.coins, target: 600, reward: 50 },
  ],
};
const MAX_LEVEL = 4;

function openQuestBoard() {
  isPaused = true;
  renderQuestList();
  document.getElementById("quest-modal").classList.remove("hidden");
}

function closeQuestBoard() {
  closeModalWithAnimation("quest-modal", () => {
    isPaused = false;
    checkInteractions();
  });
}

function renderQuestList() {
  const list = document.getElementById("quest-list");
  const nextBtn = document.getElementById("quest-next-level-btn");
  const titleEl = document.getElementById("quest-modal-level");
  if (!list) return;

  const quests = QUESTS_PER_LEVEL[state.currentLevel] || [];
  if (titleEl) titleEl.innerText = `Level ${state.currentLevel}`;

  list.innerHTML = "";
  let allClaimed = quests.length > 0;

  quests.forEach((q, i) => {
    const key = `${state.currentLevel}-${i}`;
    const claimed = state.questsClaimed.includes(key);
    const cur = Math.min(q.current(), q.target); // clamp biar gak nampilin "23/20"
    const done = cur >= q.target;
    if (!claimed) allClaimed = false;

    const row = document.createElement("div");
    row.className =
      "flex justify-between items-center gap-2 bg-white p-2 rounded-lg mb-2 border border-gray-200";
    let actionHtml;
    if (claimed) {
      actionHtml =
        '<span class="text-green-500 text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-check"></i> Selesai</span>';
    } else if (done) {
      actionHtml = `<button onclick="claimQuest(${i})" class="bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold active:scale-95 whitespace-nowrap">Klaim +${q.reward}</button>`;
    } else {
      actionHtml = '<span class="text-gray-400 text-xs whitespace-nowrap">Belum</span>';
    }
    row.innerHTML = `<span class="text-xs font-bold ${
      claimed ? "text-gray-400 line-through" : "text-gray-700"
    }">${q.desc}${claimed ? "" : ` (${cur}/${q.target})`}</span>${actionHtml}`;
    list.appendChild(row);
  });

  if (nextBtn) {
    if (allClaimed && state.currentLevel < MAX_LEVEL) {
      nextBtn.classList.remove("hidden");
      nextBtn.innerText = `Lanjut ke Level ${state.currentLevel + 1}`;
    } else if (allClaimed) {
      nextBtn.classList.add("hidden"); // udah level maksimal
    } else {
      nextBtn.classList.add("hidden");
    }
  }
}

function claimQuest(index) {
  const quests = QUESTS_PER_LEVEL[state.currentLevel] || [];
  const q = quests[index];
  const key = `${state.currentLevel}-${index}`;
  if (!q || state.questsClaimed.includes(key) || q.current() < q.target) return;

  state.questsClaimed.push(key);
  addCoins(q.reward);
  showToast(`Misi Selesai! +${q.reward} Koin`, "success");
  playSound("sfx-coin");
  renderQuestList();
  saveGame();
}

function advanceLevel() {
  if (state.currentLevel >= MAX_LEVEL) return;
  state.currentLevel++;
  applyLevelTheme(state.currentLevel);
  showToast(`🎉 Level ${state.currentLevel}: ${LEVEL_THEMES[state.currentLevel].name}!`, "success");
  playSound("sfx-coin");
  saveGame();
  renderQuestList(); // refresh modal buat misi level baru
}

// FUNGSI BARU: Mengganti model kapak secara visual
function changeAxeModel(level) {
  if (!handContainer) return;

  // 1. Hapus kapak lama (+ pickaxe kalau lagi kepasang - biar gak dobel alat di tangan
  // kalau fungsi ini kepanggil langsung dari upgradeAxe() pas equippedTool="pickaxe")
  if (axeMesh) {
    handContainer.remove(axeMesh);
    axeMesh = null; // Bersihkan referensi
  }
  if (pickaxeMesh) {
    handContainer.remove(pickaxeMesh);
    pickaxeMesh = null;
  }
  equippedTool = "axe";

  // 2. Tentukan aset berdasarkan level (max 2 - lihat catatan MAX_AXE_LEVEL)
  let assetUrl = ASSETS.axe;
  let scale = 1;

  if (level >= 2) {
    assetUrl = ASSETS.axe2;
    scale = 1.2;
  }

  // 3. Load kapak baru
  loader.load(assetUrl, (gltf) => {
    axeMesh = gltf.scene;
    axeMesh.scale.set(scale, scale, scale);
    axeMesh.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });

    // Terapkan rotasi config
    axeMesh.rotation.set(AXE_CONFIG.rotX, AXE_CONFIG.rotY, AXE_CONFIG.rotZ);
    axeMesh.position.set(0, AXE_GRIP_OFFSET_Y, 0);

    handContainer.add(axeMesh);
    console.log("Visual Kapak Updated ke Level " + level);
  });
}

// Sama persis pola changeAxeModel(), buat alat pickaxe (tambang batu) - tool terpisah
// dari kapak, punya level/upgrade sendiri.
function changePickaxeModel(level) {
  if (!handContainer) return;

  if (pickaxeMesh) {
    handContainer.remove(pickaxeMesh);
    pickaxeMesh = null;
  }
  if (axeMesh) {
    handContainer.remove(axeMesh);
    axeMesh = null;
  }
  equippedTool = "pickaxe";

  const assetUrl = level >= 2 ? ASSETS.pickaxe2 : ASSETS.pickaxe;
  const scale = level >= 2 ? 1.2 : 1;

  loader.load(assetUrl, (gltf) => {
    pickaxeMesh = gltf.scene;
    pickaxeMesh.scale.set(scale, scale, scale);
    pickaxeMesh.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    pickaxeMesh.rotation.set(AXE_CONFIG.rotX, AXE_CONFIG.rotY, AXE_CONFIG.rotZ);
    pickaxeMesh.position.set(0, AXE_GRIP_OFFSET_Y, 0);
    handContainer.add(pickaxeMesh);
    console.log("Visual Pickaxe Updated ke Level " + level);
  });
}

// Ganti alat di tangan cuma kalau targetnya beda dari yang lagi kepasang - hindari
// reload GLB tiap frame (dipanggil dari checkInteractions() tiap frame).
function ensureToolEquipped(tool) {
  if (equippedTool === tool || !handContainer) return;
  equippedTool = tool;
  if (tool === "pickaxe") {
    if (axeMesh) {
      handContainer.remove(axeMesh);
      axeMesh = null;
    }
    changePickaxeModel(state.pickaxeLevel || 1);
  } else {
    if (pickaxeMesh) {
      handContainer.remove(pickaxeMesh);
      pickaxeMesh = null;
    }
    changeAxeModel(state.axeLevel);
  }
}

// Tombol manual ganti senjata (dulu cuma otomatis lewat ensureToolEquipped() pas
// dekat pohon/batu). Cuma ganti tampilan alat di tangan - checkInteractions() masih
// otomatis nimpa balik begitu dekat pohon/batu (axe/pickaxe sesuai target), jadi
// tombol ini kepakai kalau lagi gak dekat keduanya (sekadar gaya/persiapan).
function toggleWeapon() {
  if (state.pickaxeLevel < 1) {
    showToast("Beli Pickaxe dulu di toko!", "error");
    return;
  }
  ensureToolEquipped(equippedTool === "axe" ? "pickaxe" : "axe");
}

function upgradeAxe() {
  // ponytail: dulu hardcode ">= 3" padahal ada constant MAX_AXE_LEVEL - root cause
  // fix, sekarang beneran pakai constant-nya (juga udah diubah jadi 2, lihat catatan
  // di deklarasinya).
  if (state.axeLevel >= MAX_AXE_LEVEL) {
    showToast("Kapak Sudah Level Max!", "info");
    return;
  }

  const cost = state.axeLevel * 50;
  if (state.coins >= cost) {
    state.coins -= cost;
    state.axeLevel++;
    state.axeDamage += 1;

    // --- UPDATE VISUAL KAPAK ---
    changeAxeModel(state.axeLevel);
    // ---------------------------

    updateHUD();

    // Refresh tampilan toko
    openShop();

    showToast(`Kapak Level ${state.axeLevel}!`, "success");
    playSound("sfx-coin");
    saveGame();
  } else {
    closeShop();
    showToast("Koin kurang!", "error");
    playSound("sfx-fail");
  }
}

// Sama pola upgradeAxe(), buat pickaxe. Beda dikit: pickaxeLevel mulai dari 0 (belum
// punya), jadi pembelian pertama (0->1) sekaligus jadi "beli alatnya" - tanpa ini
// menambang gak bisa jalan (lihat gerbang di performMine()).
function upgradePickaxe() {
  if (state.pickaxeLevel >= MAX_PICKAXE_LEVEL) {
    showToast("Pickaxe Sudah Level Max!", "info");
    return;
  }

  const cost = (state.pickaxeLevel + 1) * 50;
  if (state.coins >= cost) {
    const isFirstBuy = state.pickaxeLevel === 0;
    state.coins -= cost;
    state.pickaxeLevel++;
    state.pickaxeDamage += 1;

    changePickaxeModel(state.pickaxeLevel);

    updateHUD();
    openShop();

    showToast(
      isFirstBuy ? "Pickaxe Dibeli!" : `Pickaxe Level ${state.pickaxeLevel}!`,
      "success"
    );
    playSound("sfx-coin");
    saveGame();
  } else {
    closeShop();
    showToast("Koin kurang!", "error");
    playSound("sfx-fail");
  }
}

function upgradeStamina() {
  const cost = 100 + (state.maxStamina - 100) * 2;
  if (state.coins >= cost) {
    state.coins -= cost;
    state.maxStamina += 20;
    state.stamina = state.maxStamina;
    updateHUD();
    updateStaminaUI();

    // Refresh tampilan toko
    openShop();

    showToast(`Stamina Diupgrade! Max: ${state.maxStamina}`, "success");
    playSound("sfx-coin");
    saveGame();
  } else {
    // --- UPDATE: Tutup toko jika gagal ---
    closeShop();
    // -------------------------------------
    showToast("Koin kurang!", "error");
    playSound("sfx-fail");
  }
}

// Konfigurasi jual barang - kayu/emas/batu bara sekarang bisa dipilih jumlahnya
// (dulu cuma "JUAL SEMUA"), plus keterangan harga (lihat updateSellPrice/sellResource).
const SELL_CONFIG = {
  wood: { price: 5, label: "Kayu" },
  gold: { price: ORE_TYPES.gold.sellPrice, label: "Emas" },
  coal: { price: ORE_TYPES.coal.sellPrice, label: "Batu Bara" },
};

// Isi qty default (= stok penuh) & keterangan harga tiap kali toko dibuka/refresh
function refreshSellInputs() {
  for (const type in SELL_CONFIG) {
    const input = document.getElementById(`sell-qty-${type}`);
    if (!input) continue;
    input.max = state[type];
    input.value = state[type];
    updateSellPrice(type);
  }
}

function updateSellPrice(type) {
  const cfg = SELL_CONFIG[type];
  const input = document.getElementById(`sell-qty-${type}`);
  if (!cfg || !input) return;
  let qty = Math.floor(Number(input.value)) || 0;
  qty = Math.max(0, Math.min(state[type], qty));
  input.value = qty;
  document.getElementById(`sell-price-${type}`).innerText = qty * cfg.price;
}

function sellResource(type) {
  const cfg = SELL_CONFIG[type];
  const input = document.getElementById(`sell-qty-${type}`);
  const qty = Math.max(0, Math.min(state[type], Math.floor(Number(input.value)) || 0));

  if (qty <= 0) {
    showToast(`Jumlah ${cfg.label} tidak valid!`, "error");
    return;
  }

  const earn = qty * cfg.price;
  state[type] -= qty;
  addCoins(earn);
  closeShop();
  showToast(`Terjual ${qty} ${cfg.label}! +${earn} Koin`, "success");
  playSound("sfx-coin");
  saveGame();
}

function sleep() {
  // Tampilkan Layar Tidur
  const sleepScreen = document.getElementById("sleep-screen");
  sleepScreen.classList.remove("hidden");

  // PERBAIKAN: Gunakan "flex", bukan "fixed" agar konten di tengah terlihat
  sleepScreen.style.display = "flex";

  // Pause game state
  isPaused = true;
}

function wakeUp() {
  // Sembunyikan Layar Tidur
  const sleepScreen = document.getElementById("sleep-screen");
  sleepScreen.classList.add("hidden");
  sleepScreen.style.display = "none";

  // Pulihkan Stamina
  state.stamina = state.maxStamina;
  updateStaminaUI();

  // Simpan Game
  saveGame();

  // Resume Game
  isPaused = false;

  // Pesan (Tanpa merubah cuaca/waktu secara paksa)
  showToast("Stamina Pulih Sepenuhnya!", "success");
}

function updateHUD() {
  document.getElementById("wood-val").innerText = state.wood;
  document.getElementById("gold-val").innerText = state.gold;
  document.getElementById("coal-val").innerText = state.coal;
  document.getElementById("coin-val").innerText = state.coins;
}

function updateStaminaUI() {
  const fill = document.getElementById("stamina-bar");
  const text = document.getElementById("stamina-text"); // Ambil elemen teks

  if (!fill) return;

  const current = Math.floor(state.stamina);
  const max = state.maxStamina;
  const pct = (state.stamina / state.maxStamina) * 100;

  fill.style.width = pct + "%";

  // UPDATE: Tampilkan angka
  if (text) {
    text.innerText = `${current}/${max}`;
  }

  if (pct < 20) fill.style.background = "#e74c3c";
  else fill.style.background = "linear-gradient(to right, #f1c40f, #e67e22)";
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  container.innerHTML = ""; // Hapus info sebelumnya dulu, jangan numpuk berantai
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon =
    type === "success"
      ? '<i class="fa-solid fa-circle-check"></i>'
      : type === "error"
      ? '<i class="fa-solid fa-circle-xmark"></i>'
      : '<i class="fa-solid fa-circle-info"></i>';
  toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// --- HELPER ANIMASI MODAL ---
function closeModalWithAnimation(modalId, onComplete) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const content = modal.querySelector(".modal-content");

  // Tambahkan class animasi keluar
  content.classList.add("closing");

  // Tunggu animasi selesai (300ms sesuai CSS)
  setTimeout(() => {
    modal.classList.add("hidden");
    content.classList.remove("closing");
    if (onComplete) onComplete();
  }, 280); // Sedikit kurang dari 300ms agar smooth
}

// --- KONFIRMASI GENERIK (dipakai tombol back HP & browser) ---
function showConfirm(title, msg, onYes) {
  document.getElementById("confirm-modal-title").innerText = title;
  document.getElementById("confirm-modal-msg").innerText = msg;
  document.getElementById("confirm-modal-yes-btn").onclick = () => {
    closeConfirmModal();
    onYes();
  };
  document.getElementById("confirm-modal").classList.remove("hidden");
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
}

// Tombol back HP (dipanggil MainActivity.kt via window.onAndroidBack) & tombol/gesture
// back browser (via popstate di bawah). Modal lain yang kebuka ditutup dulu; kalau gak
// ada modal, baru tanya balik-ke-menu (saat main) atau keluar app (saat di menu utama).
function handleBackPress() {
  // ponytail: panggil fungsi close ASLI tiap modal (bukan cuma classList.add("hidden"))
  // - beberapa modal (shop-modal dkk) nge-set isPaused=true saat buka, dan cuma resume
  // lewat callback di fungsi close-nya sendiri. Nutup paksa tanpa lewat situ bikin
  // isPaused nyangkut true selamanya (game keliatan freeze).
  const modalClosers = {
    "settings-modal": closeSettings,
    "shop-modal": closeShop,
    "info-modal": closeInfo,
    "axe-info-modal": closeAxeInfo,
    "stats-modal": closeStats,
    "character-modal": closeCharacterPicker,
    "map-modal": closeMapModal,
    "confirm-modal": closeConfirmModal,
  };
  for (const id in modalClosers) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("hidden")) {
      modalClosers[id]();
      return;
    }
  }

  const onStartScreen =
    document.getElementById("start-screen").style.display !== "none";
  if (onStartScreen) {
    showConfirm("Keluar Game", "Yakin mau keluar dari game?", exitApp);
  } else {
    showConfirm(
      "Kembali ke Menu",
      "Kembali ke menu utama? Progress otomatis tersimpan.",
      goToMainMenu
    );
  }
}
window.onAndroidBack = handleBackPress;

// Parity buat versi web (bukan APK): tombol/gesture back browser munculin konfirmasi
// yang sama, bukan langsung ninggalin halaman.
history.pushState(null, "", location.href);
window.addEventListener("popstate", () => {
  history.pushState(null, "", location.href); // "telan" navigasi back, tetap di halaman
  handleBackPress();
});

function updateRealTimeClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("clock-display").innerText = timeString;
  const hour = now.getHours();
  const isNightNow = hour >= 18 || hour < 6;
  if (isNightNow !== state.isNight) {
    state.isNight = isNightNow;
    if (state.isNight) {
      skyMesh.material.uniforms.topColor.value.setHex(0x000000);
      skyMesh.material.uniforms.bottomColor.value.setHex(0x0f2027);
      sunLight.intensity = 0.1;
      hemiLight.intensity = 0.1;
      scene.fog.color.setHex(0x0f2027);
    } else {
      skyMesh.material.uniforms.topColor.value.setHex(0x0077ff);
      skyMesh.material.uniforms.bottomColor.value.setHex(0xffffff);
      sunLight.intensity = 1.2;
      hemiLight.intensity = 0.6;
      scene.fog.color.setHex(0x87ceeb);
    }
  }
}

// --- POPUP PETA BESAR (diklik dari minimap, bisa digeser) ---
let mapDragState = { dragging: false, startX: 0, startY: 0, offX: 0, offY: 0, moved: 0 };
const MAP_CANVAS_SIZE = 600;
let mapPin = null; // {x, z} koordinat dunia - ditaruh user via ketuk di peta besar, muncul juga di minimap kecil

function worldToMapXY(wx, wz) {
  const scale = 280 / MAP_RADIUS_COLLISION;
  return { x: MAP_CANVAS_SIZE / 2 + wx * scale, y: MAP_CANVAS_SIZE / 2 + wz * scale };
}

// Kebalikan worldToMapXY - dipakai buat konversi posisi ketuk di peta balik ke
// koordinat dunia nyata (buat naruh pin).
function mapXYToWorld(mapX, mapY) {
  const scale = 280 / MAP_RADIUS_COLLISION;
  return { x: (mapX - MAP_CANVAS_SIZE / 2) / scale, z: (mapY - MAP_CANVAS_SIZE / 2) / scale };
}

function placeMapPinFromScreen(clientX, clientY) {
  const inner = document.getElementById("map-canvas-inner");
  if (!inner) return;
  const rect = inner.getBoundingClientRect();
  mapPin = mapXYToWorld(clientX - rect.left, clientY - rect.top);
  renderMapDots();
}

function clearMapPin() {
  mapPin = null;
  renderMapDots();
}

function addMapDot(inner, wx, wz, color, size = 6) {
  const p = worldToMapXY(wx, wz);
  const dot = document.createElement("div");
  dot.className = "map-dot";
  dot.style.left = p.x + "px";
  dot.style.top = p.y + "px";
  dot.style.width = size + "px";
  dot.style.height = size + "px";
  dot.style.background = color;
  inner.appendChild(dot);
}

function renderMapDots() {
  const inner = document.getElementById("map-canvas-inner");
  if (!inner) return;
  inner.innerHTML = "";

  if (shopArea) addMapDot(inner, shopArea.position.x, shopArea.position.z, "#f1c40f", 14);
  if (homeArea) addMapDot(inner, homeArea.position.x, homeArea.position.z, "#3498db", 14);
  addMapDot(inner, STORE2_POS.x, STORE2_POS.z, "#9b59b6", 14); // Papan Misi (toko kedua)
  trees.forEach((t) => addMapDot(inner, t.position.x, t.position.z, "#e74c3c", 6));
  rocks.forEach((r) => addMapDot(inner, r.position.x, r.position.z, "#95a5a6", 6));
  oreRocks.forEach((o) => {
    // ponytail: gold dulu "#ffd700" - kekuningan mirip banget sama titik toko
    // (#f1c40f), gampang ketuker di minimap. Ganti oranye biar beda jauh.
    const color = o.userData.oreType === "gold" ? "#e67e22" : "#7f8c8d";
    addMapDot(inner, o.position.x, o.position.z, color, 7);
  });

  // Pin penanda custom (kalau ada) - ditaruh user sendiri via ketuk di peta ini.
  if (mapPin) {
    const pp = worldToMapXY(mapPin.x, mapPin.z);
    const pinEl = document.createElement("div");
    pinEl.className = "map-pin";
    pinEl.style.left = pp.x + "px";
    pinEl.style.top = pp.y + "px";
    pinEl.innerHTML = "📍";
    inner.appendChild(pinEl);
  }

  // Titik player = panah arah hadap + cone arah kamera, sama persis kayak minimap kecil
  // (dulu di peta besar ini cuma lingkaran polos, gak ada arah).
  if (player) {
    const p = worldToMapXY(player.position.x, player.position.z);

    const camEl = document.createElement("div");
    camEl.className = "map-camera-cone";
    camEl.style.left = p.x + "px";
    camEl.style.top = p.y + "px";
    camEl.style.transform = `translate(-50%, -50%) rotate(${-cameraAngle + Math.PI}rad)`;
    inner.appendChild(camEl);

    const pEl = document.createElement("div");
    pEl.className = "map-player";
    pEl.style.left = p.x + "px";
    pEl.style.top = p.y + "px";
    pEl.style.transform = `translate(-50%, -50%) rotate(${-player.rotation.y + Math.PI}rad)`;
    inner.appendChild(pEl);
  }
}

function centerMapOnPlayer() {
  const wrapper = document.getElementById("map-canvas-wrapper");
  const inner = document.getElementById("map-canvas-inner");
  if (!wrapper || !inner || !player) return;
  const p = worldToMapXY(player.position.x, player.position.z);
  const w = wrapper.offsetWidth,
    h = wrapper.offsetHeight;
  let left = Math.min(0, Math.max(w - MAP_CANVAS_SIZE, w / 2 - p.x));
  let top = Math.min(0, Math.max(h - MAP_CANVAS_SIZE, h / 2 - p.y));
  inner.style.left = left + "px";
  inner.style.top = top + "px";
}

function openMapModal() {
  isPaused = true;
  renderMapDots();
  document.getElementById("map-modal").classList.remove("hidden");
  centerMapOnPlayer();
}

function closeMapModal() {
  closeModalWithAnimation("map-modal", () => {
    isPaused = false;
    checkInteractions();
  });
}

function setupMapDrag() {
  const wrapper = document.getElementById("map-canvas-wrapper");
  const inner = document.getElementById("map-canvas-inner");
  if (!wrapper || !inner) return;

  function getXY(e) {
    if (e.touches && e.touches[0])
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0])
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }
  function start(e) {
    mapDragState.dragging = true;
    mapDragState.moved = 0;
    wrapper.classList.add("dragging");
    const p = getXY(e);
    mapDragState.startX = p.x;
    mapDragState.startY = p.y;
    mapDragState.offX = parseFloat(inner.style.left) || 0;
    mapDragState.offY = parseFloat(inner.style.top) || 0;
  }
  function move(e) {
    if (!mapDragState.dragging) return;
    e.preventDefault();
    const p = getXY(e);
    mapDragState.moved = Math.max(
      mapDragState.moved,
      Math.hypot(p.x - mapDragState.startX, p.y - mapDragState.startY)
    );
    const w = wrapper.offsetWidth,
      h = wrapper.offsetHeight;
    let left = mapDragState.offX + (p.x - mapDragState.startX);
    let top = mapDragState.offY + (p.y - mapDragState.startY);
    left = Math.min(0, Math.max(w - MAP_CANVAS_SIZE, left));
    top = Math.min(0, Math.max(h - MAP_CANVAS_SIZE, top));
    inner.style.left = left + "px";
    inner.style.top = top + "px";
  }
  function end(e) {
    const wasDragging = mapDragState.dragging;
    mapDragState.dragging = false;
    wrapper.classList.remove("dragging");
    // Gerakan kecil (bukan geser peta) = dihitung KETUK - taruh pin penanda di situ.
    if (wasDragging && mapDragState.moved < 8) {
      const p = getXY(e);
      placeMapPinFromScreen(p.x, p.y);
    }
  }

  wrapper.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  wrapper.addEventListener("touchstart", start, { passive: true });
  wrapper.addEventListener("touchmove", move, { passive: false });
  wrapper.addEventListener("touchend", end);
}

function updateMinimap() {
  if (!player) return;

  const map = document.getElementById("minimap");
  map.innerHTML = ""; // Bersihkan dot lama

  // Ambil ukuran dinamis dari CSS (agar responsif potret/landscape)
  const mapW = map.offsetWidth;
  const mapH = map.offsetHeight;
  const radiusUI = mapW / 2; // Jari-jari visual minimap dalam pixel

  // Skala zoom map (semakin kecil angka, semakin luas area yang terlihat)
  // Sesuaikan nilai 4.5 ini jika ingin zoom in/out map
  const scale = radiusUI / 45;

  // --- 0. ARAH KAMERA (wedge transparan di belakang titik pemain) ---
  const camEl = document.createElement("div");
  camEl.className = "map-camera-cone";
  camEl.style.left = radiusUI + "px";
  camEl.style.top = radiusUI + "px";
  const camRot = -cameraAngle + Math.PI;
  camEl.style.transform = `translate(-50%, -50%) rotate(${camRot}rad)`;
  map.appendChild(camEl);

  // --- 1. TITIK PEMAIN (TETAP DI TENGAH) ---
  const pEl = document.createElement("div");
  pEl.className = "map-player";
  pEl.style.left = radiusUI + "px";
  pEl.style.top = radiusUI + "px";

  // Rotasi panah (dibalik + Math.PI agar lancip ke depan)
  const rot = -player.rotation.y + Math.PI;
  pEl.style.transform = `translate(-50%, -50%) rotate(${rot}rad)`;
  map.appendChild(pEl);

  // --- FUNGSI HELPER UNTUK MEMBUAT TITIK ---
  // isImportant = true : Titik akan nempel di pinggir jika jauh (Toko/Rumah)
  // isImportant = false: Titik hilang jika jauh (Pohon)
  function addDot(wx, wz, color, isImportant = false) {
    // Hitung jarak relatif terhadap player di dunia 3D
    const dx = wx - player.position.x;
    const dz = wz - player.position.z;

    // Konversi ke koordinat layar minimap (X kanan, Y bawah)
    // Di Three.js, Z adalah kedalaman, jadi Z dunia -> Y minimap
    let screenX = dx * scale;
    let screenY = dz * scale;

    // Hitung jarak titik dari pusat minimap
    const dist = Math.sqrt(screenX * screenX + screenY * screenY);

    // Batas aman agar titik tidak keluar lingkaran (dikurangi ukuran dot)
    const limit = radiusUI - 6;

    // Logika Clamping (Menahan di pinggir)
    if (dist > limit) {
      if (isImportant) {
        // Jika penting, tahan di pinggir lingkaran sesuai sudutnya
        const angle = Math.atan2(screenY, screenX);
        screenX = Math.cos(angle) * limit;
        screenY = Math.sin(angle) * limit;
      } else {
        // Jika tidak penting (pohon), jangan ditampilkan
        return;
      }
    }

    // Buat elemen titik
    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.width = "6px";
    dot.style.height = "6px";
    dot.style.backgroundColor = color;
    dot.style.borderRadius = "50%";
    dot.style.transform = "translate(-50%, -50%)"; // Center pivot

    // Posisi final (Pusat Map + Offset)
    dot.style.left = radiusUI + screenX + "px";
    dot.style.top = radiusUI + screenY + "px";

    // Tambahkan style shadow/border agar terlihat jelas di pinggir
    if (isImportant) {
      dot.style.border = "1px solid white";
      dot.style.zIndex = "5"; // Di atas pohon
      dot.style.width = "8px"; // Sedikit lebih besar
      dot.style.height = "8px";
    }

    map.appendChild(dot);
  }

  // --- 2. TAMBAHKAN OBJEK PENTING (CLAMPED) ---
  addDot(shopArea.position.x, shopArea.position.z, "#f1c40f", true); // Toko (Kuning) - PENTING
  addDot(homeArea.position.x, homeArea.position.z, "#3498db", true); // Rumah (Biru) - PENTING
  addDot(STORE2_POS.x, STORE2_POS.z, "#9b59b6", true); // Papan Misi (Ungu) - PENTING

  // --- 3. TAMBAHKAN POHON (TIDAK CLAMPED) ---
  trees.forEach((t) => addDot(t.position.x, t.position.z, "#e74c3c", false));

  // --- 4. TITIK TAMBANG EMAS & BATU BARA ---
  oreRocks.forEach((o) => {
    // ponytail: gold dulu "#ffd700" - kekuningan mirip banget sama titik toko
    // (#f1c40f), gampang ketuker di minimap. Ganti oranye biar beda jauh.
    const color = o.userData.oreType === "gold" ? "#e67e22" : "#7f8c8d";
    addDot(o.position.x, o.position.z, color, false);
  });

  // --- 5. PIN PENANDA CUSTOM (kalau ada) - sama logika clamp-ke-pinggir kayak toko/rumah ---
  if (mapPin) {
    const dx = mapPin.x - player.position.x;
    const dz = mapPin.z - player.position.z;
    let screenX = dx * scale;
    let screenY = dz * scale;
    const dist = Math.hypot(screenX, screenY);
    const limit = radiusUI - 6;
    if (dist > limit) {
      const angle = Math.atan2(screenY, screenX);
      screenX = Math.cos(angle) * limit;
      screenY = Math.sin(angle) * limit;
    }
    const pinEl = document.createElement("div");
    pinEl.style.position = "absolute";
    pinEl.style.left = radiusUI + screenX + "px";
    pinEl.style.top = radiusUI + screenY + "px";
    pinEl.style.transform = "translate(-50%, -100%)";
    pinEl.style.fontSize = "14px";
    pinEl.style.zIndex = "6";
    pinEl.innerHTML = "📍";
    map.appendChild(pinEl);
  }
}

function updateTreeHPBar() {
  const barContainer = document.getElementById("tree-hp-container");
  const barFill = document.getElementById("tree-hp-bar");
  const energyLabel = document.getElementById("tree-energy-label");

  // Dipakai buat pohon MAUPUN batu tambang (gold/coal) - keduanya punya
  // userData.hp/maxHp, jadi bar HP yang sama bisa dipakai buat dua-duanya ("darah"
  // pas nambang, sebelumnya cuma pohon yang dapet bar ini).
  const target = state.nearTree || state.nearOre;

  if (target) {
    // UPDATE: Turunkan offset Y dari 7 ke 3.5 (Lebih dekat ke pemain)
    const vec = target.position
      .clone()
      .add(new THREE.Vector3(0, 3.5, 0))
      .project(camera);

    // Cek jika di belakang kamera
    if (vec.z > 1 || Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) {
      barContainer.style.display = "none";
      return;
    }

    barContainer.style.display = "block";
    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;

    // Hitung posisi Y
    let y = (-(vec.y * 0.5) + 0.5) * window.innerHeight;

    // UPDATE: Clamp/Batas Atas agar bar tidak hilang keluar layar saat zoom in
    // Minimal 50px dari atas layar
    if (y < 50) y = 50;

    barContainer.style.left = x + "px";
    barContainer.style.top = y + "px";

    const pct = (target.userData.hp / target.userData.maxHp) * 100;
    barFill.style.width = pct + "%";

    // Keterangan alat salah - pohon butuh kapak, batu tambang butuh pickaxe (lihat
    // gerbang yang sama di performChop()/performMine()). Ganti tulisan biaya energi
    // jadi peringatan kalau alat yang lagi dipegang gak cocok.
    if (energyLabel) {
      const requiredTool = state.nearTree ? "axe" : "pickaxe";
      if (equippedTool !== requiredTool) {
        energyLabel.innerText =
          requiredTool === "axe" ? "⚠️ Butuh Kapak!" : "⚠️ Butuh Pickaxe!";
        energyLabel.style.color = "#ff5c5c";
      } else {
        energyLabel.innerText = `⚡ ${getStaminaCost(target)}`;
        energyLabel.style.color = "#fff";
      }
    }
  } else {
    barContainer.style.display = "none";
  }
}

function updateHomeInfoBubble() {
  const el = document.getElementById("home-info-bubble");
  if (!el || !homeArea || !player) return;

  const dist = player.position.distanceTo(homeArea.position);
  if (dist > INTERACTION_RADII.home + 5) {
    el.style.display = "none";
    return;
  }

  const vec = homeArea.position
    .clone()
    .add(new THREE.Vector3(0, 8, 0))
    .project(camera);
  if (vec.z > 1 || Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) {
    el.style.display = "none";
    return;
  }

  el.style.display = "block";
  el.style.left = (vec.x * 0.5 + 0.5) * window.innerWidth + "px";
  el.style.top = (-(vec.y * 0.5) + 0.5) * window.innerHeight + "px";
  el.innerHTML = state.isNight
    ? '<i class="fa-solid fa-bed"></i> Malam hari - waktunya tidur!'
    : '<i class="fa-solid fa-house"></i> Rumah - tidur di sini buat pulihkan stamina';
}

// --- OBROLAN INTERAKTIF DENGAN NPC KARYAWAN (balon di atas kepala, bukan modal) ---
// ponytail: dulu 1 skrip 3-baris doang, diulang SELAMANYA tiap deketin NPC - kerasa
// basi. Sekarang kumpulan skrip, dipilih ACAK tiap kali obrolan mulai (bukan tiap
// frame - lihat currentChatLines di-set sekali pas chatActive baru jadi true).
const EMPLOYEE_CHAT_SETS = [
  [
    { speaker: "npc", text: "Hai! Butuh kayu atau mau upgrade kapak?" },
    { speaker: "player", text: "Nanti aku mampir ke tokomu ya!" },
    { speaker: "npc", text: "Siap, ditunggu di toko!" },
  ],
  [
    { speaker: "npc", text: "Eh, kapak kamu udah level berapa sekarang?" },
    { speaker: "player", text: "Masih level segini, koinnya lagi dikumpulin." },
    { speaker: "npc", text: "Semangat! Batu tambang di sekitar sini lumayan banyak lho." },
  ],
  [
    { speaker: "npc", text: "Katanya ada misi baru di papan misi, udah cek belum?" },
    { speaker: "player", text: "Belum sempat, nanti aku ke sana." },
    { speaker: "npc", text: "Hadiahnya lumayan buat tambahan modal upgrade!" },
  ],
  [
    { speaker: "npc", text: "Hati-hati kalau nebang pohon malam-malam ya." },
    { speaker: "player", text: "Tenang, staminaku masih cukup kok." },
    { speaker: "npc", text: "Bagus, jangan lupa istirahat di rumah kalau capek." },
  ],
  [
    { speaker: "npc", text: "Denger-denger kadang ada pohon atau batu langka muncul." },
    { speaker: "player", text: "Beneran? Hadiahnya lebih besar dong?" },
    { speaker: "npc", text: "Iya, kalau ketemu buruan tebang/tambang, jangan sampai lewat!" },
  ],
];
let chatActive = false;
let chatIndex = 0;
let currentChatLines = EMPLOYEE_CHAT_SETS[0]; // di-random ulang tiap obrolan baru mulai
let chatApproached = false; // biar obrolan gak restart tiap frame selama masih deket

function updateEmployeeChat() {
  if (!employeeNpc || !player) return;
  const NEAR = 6;
  const dist = player.position.distanceTo(employeeNpc.position);

  if (dist < NEAR) {
    if (!chatActive && !chatApproached) {
      chatActive = true;
      chatIndex = 0;
      currentChatLines =
        EMPLOYEE_CHAT_SETS[Math.floor(Math.random() * EMPLOYEE_CHAT_SETS.length)];
      chatApproached = true;
    }
  } else {
    chatApproached = false; // keluar jangkauan -> "bersenjata" lagi buat trigger berikutnya
    if (chatActive) {
      chatActive = false;
    }
  }

  if (chatActive) showChatBubble();
  else hideChatBubble();
}

function showChatBubble() {
  const bubble = document.getElementById("chat-bubble");
  const line = currentChatLines[chatIndex];
  if (!bubble || !line) {
    chatActive = false;
    hideChatBubble();
    return;
  }

  const anchor = line.speaker === "npc" ? employeeNpc.position : player.position;
  const vec = anchor.clone().add(new THREE.Vector3(0, 3.2, 0)).project(camera);
  if (vec.z > 1 || Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) {
    bubble.style.display = "none";
    return;
  }

  bubble.style.display = "block";
  bubble.style.left = (vec.x * 0.5 + 0.5) * window.innerWidth + "px";
  bubble.style.top = (-(vec.y * 0.5) + 0.5) * window.innerHeight + "px";
  document.getElementById("chat-bubble-text").innerText = line.text;

  const isLast = chatIndex >= currentChatLines.length - 1;
  document.getElementById("chat-next-btn").innerText = isLast ? "Tutup" : "Lanjut";
}

function hideChatBubble() {
  const bubble = document.getElementById("chat-bubble");
  if (bubble) bubble.style.display = "none";
}

function chatNext() {
  chatIndex++;
  if (chatIndex >= currentChatLines.length) {
    chatActive = false;
    hideChatBubble();
  }
}

function chatSkip() {
  chatActive = false;
  hideChatBubble();
}

function loadSaveData() {
  const saved = localStorage.getItem("penebangSave");
  if (saved) {
    const data = JSON.parse(saved);

    // Kembalikan data lama
    state.wood = parseInt(data.wood) || 0;
    state.gold = parseInt(data.gold) || 0;
    state.coal = parseInt(data.coal) || 0;
    state.coins = parseInt(data.coins) || 0;
    state.axeLevel = parseInt(data.axeLevel) || 1; // Load level kapak
    state.axeDamage = parseInt(data.axeDamage) || 1;
    state.pickaxeLevel = parseInt(data.pickaxeLevel) || 0;
    state.pickaxeDamage = parseInt(data.pickaxeDamage) || 0;
    state.maxStamina = parseInt(data.maxStamina) || 100;
    state.lastPlayedDate = data.lastPlayedDate || "";
    state.lifetimeCoinsEarned = parseInt(data.lifetimeCoinsEarned) || 0;
    state.milestonesSeen = Array.isArray(data.milestonesSeen) ? data.milestonesSeen : [];
    state.currentLevel = parseInt(data.currentLevel) || 1;
    state.questsClaimed = Array.isArray(data.questsClaimed) ? data.questsClaimed : [];

    // Jangan load stamina 0, minimal full kalau baru load (opsional, atau load data.stamina)
    state.stamina = parseFloat(data.stamina) || state.maxStamina;

    // Simpan data posisi
    if (data.lastPos) {
      pendingSaveData = {
        pos: data.lastPos,
        camAngle: data.lastCamAngle || 0,
      };
    }

    // Update UI agar visual sesuai data
    updateHUD();
    updateStaminaUI();
  }
}

// Bonus main tiap hari (real-world, bukan hari in-game) - reuse pola tanggal
// sederhana (toDateString), gak perlu logic kalender/streak yang ribet.
function checkDailyBonus() {
  const today = new Date().toDateString();
  if (state.lastPlayedDate === today) return; // udah dapet hari ini
  state.lastPlayedDate = today;
  const bonus = 20;
  addCoins(bonus);
  showToast(`Bonus Main Harian! +${bonus} Koin`, "success");
  saveGame();
}

// Helper nambah koin - satu tempat buat jaga state.lifetimeCoinsEarned (dasar
// achievement) tetap sinkron tiap kali koin nambah, dari mana pun sumbernya.
function addCoins(amount) {
  state.coins += amount;
  state.lifetimeCoinsEarned += amount;
  updateHUD();
  checkMilestones();
}

const MILESTONE_THRESHOLDS = [100, 500, 2000, 10000];
function checkMilestones() {
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (
      state.lifetimeCoinsEarned >= threshold &&
      !state.milestonesSeen.includes(threshold)
    ) {
      state.milestonesSeen.push(threshold);
      // ponytail: delay dikit - addCoins() dipanggil dari tengah fungsi lain yang
      // biasanya nampilin toast-nya SENDIRI tepat sesudahnya (mis. "Terjual...").
      // Toast kita clear-previous-dulu (lihat showToast), jadi tanpa delay toast
      // achievement ini bakal ke-timpa instan sebelum sempat kebaca. Tunggu toast
      // yang lain selesai (2.5s) dulu baru tampil.
      setTimeout(() => {
        showToast(`🏆 Pencapaian! Total ${threshold} Koin terkumpul!`, "success");
      }, 2700);
      break; // satu toast per panggilan - hindari beruntun kalau lompat beberapa threshold sekaligus
    }
  }
}

function saveGame() {
  // Update posisi terakhir ke dalam state sebelum save
  if (player) {
    state.lastPos = {
      x: player.position.x,
      z: player.position.z,
      rot: player.rotation.y,
    };
    state.lastCamAngle = cameraAngle; // Simpan sudut pandang kamera
  }
  localStorage.setItem("penebangSave", JSON.stringify(state));
}

function setupControls() {
  setupMapDrag();

  // 1. Keyboard (Tetap sama)
  document.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === "Enter") handleAction();
    if (e.key === " ") jump();
    if (e.key === "Shift") toggleRun(true);
  });
  document.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (e.key === "Shift") toggleRun(false);
  });

  // 2. Kontrol Joystick - "mengambang": nongol tepat di titik jempol nyentuh di
  // dalam #joystick-zone (area luas kiri-bawah layar), bukan fixed di 1 titik kecil.
  // Root cause bug lama: kalau jempol meleset dikit dari wrapper kecil yg fixed,
  // sentuhan jatuh ke listener swipe-kamera (document touchmove) -> layar ikut geser.
  if ("ontouchstart" in window) {
    const jZone = document.getElementById("joystick-zone");
    const jWrapper = document.getElementById("joystick-wrapper");
    const jStick = document.getElementById("joystick-stick");

    jZone.addEventListener(
      "touchstart",
      (e) => {
        if (joystick.active) return; // udah ada drag jalan, jangan restart
        e.stopPropagation();
        const t = e.touches[0];
        const size = jWrapper.offsetWidth || 120;
        jWrapper.style.bottom = "auto";
        jWrapper.style.left = t.clientX - size / 2 + "px";
        jWrapper.style.top = t.clientY - size / 2 + "px";
        jWrapper.style.display = "block";
        joystick.active = true;
        joystick.originX = t.clientX;
        joystick.originY = t.clientY;
      },
      { passive: true }
    );

    jZone.addEventListener(
      "touchmove",
      (e) => {
        if (!joystick.active) return;
        e.stopPropagation();
        e.preventDefault();
        const dx = e.touches[0].clientX - joystick.originX;
        const dy = e.touches[0].clientY - joystick.originY;
        const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), 40);
        const ang = Math.atan2(dy, dx);
        joystick.x = (Math.cos(ang) * dist) / 40;
        joystick.y = (Math.sin(ang) * dist) / 40;
        jStick.style.transform = `translate(-50%,-50%) translate(${
          Math.cos(ang) * dist
        }px, ${Math.sin(ang) * dist}px)`;
      },
      { passive: false }
    );

    jZone.addEventListener("touchend", (e) => {
      e.stopPropagation();
      joystick.active = false;
      joystick.x = 0;
      joystick.y = 0;
      jStick.style.transform = `translate(-50%,-50%)`;
      jWrapper.style.display = "none"; // sembunyi lagi sampai disentuh berikutnya
    });

    // Handle Tombol Run/Jump agar tidak dianggap swipe
    const btns = document.querySelectorAll(".btn-game, .btn-action");
    btns.forEach((btn) => {
      btn.addEventListener("touchstart", (e) => e.stopPropagation());
      btn.addEventListener("touchmove", (e) => e.stopPropagation());
    });

    // Logic khusus Run Button
    const runBtn = document.getElementById("run-btn");
    runBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRun(true);
    });
    runBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRun(false);
    });
  }

  // 3. ZOOM (Scroll Mouse)
  document.addEventListener(
    "wheel",
    (e) => {
      if (!gameStarted || isPaused) return;
      const zoomSpeed = 0.001;
      cameraZoom += e.deltaY * zoomSpeed;
      cameraZoom = Math.max(0.6, Math.min(1.6, cameraZoom));
    },
    { passive: false }
  );

  // --- 4. LOGIKA PUTAR KAMERA (LAPTOP: Double Click & Hold) ---
  let lastClickTime = 0;

  document.addEventListener("mousedown", (e) => {
    const now = Date.now();
    if (now - lastClickTime < 300) {
      isRotating = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY; // TAMBAHAN: Simpan Y awal
    }
    lastClickTime = now;
  });

  document.addEventListener("mousemove", (e) => {
    if (isRotating) {
      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY; // TAMBAHAN: Hitung selisih Y

      cameraAngle -= deltaX * 0.005;
      cameraIdleTimer = 0; // user lagi geser manual, tunda auto-follow

      // TAMBAHAN: Ubah pitch berdasarkan gerakan mouse Y (inverse biar natural)
      cameraPitch += deltaY * 0.05;

      lastMouseX = e.clientX;
      lastMouseY = e.clientY; // TAMBAHAN: Update Y terakhir
    }
  });

  document.addEventListener("mouseup", () => {
    isRotating = false;
  });

  // --- 5. LOGIKA PUTAR KAMERA (MOBILE: Swipe Layar) ---
  let lastTouchX = 0;

  // --- 5. LOGIKA PUTAR KAMERA (MOBILE: Swipe Layar) ---
  // (Variabel lastTouchX sudah ada di atas, lastTouchY ditambahkan di globals)

  document.addEventListener(
    "touchstart",
    (e) => {
      // Zoom (2 jari) - Tetap sama
      if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        touchStartDist = Math.hypot(dx, dy);
      }
      // Putar Kamera (1 jari)
      else if (e.touches.length === 1) {
        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY; // TAMBAHAN: Simpan Y awal
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      // Zoom Logic - Tetap sama
      if (e.touches.length === 2) {
        // ... (kode zoom lama) ...
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        const dist = Math.hypot(dx, dy);
        const diff = touchStartDist - dist;
        cameraZoom += diff * 0.005;
        cameraZoom = Math.max(0.6, Math.min(1.6, cameraZoom));
        touchStartDist = dist;
      }
      // Logic Putar Kamera
      else if (e.touches.length === 1 && !joystick.active) {
        const deltaX = e.touches[0].pageX - lastTouchX;
        const deltaY = e.touches[0].pageY - lastTouchY; // TAMBAHAN: Hitung delta Y

        cameraAngle -= deltaX * 0.005;
        cameraIdleTimer = 0; // user lagi geser manual, tunda auto-follow

        // TAMBAHAN: Ubah pitch berdasarkan swipe Y
        cameraPitch += deltaY * 0.05;

        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY; // TAMBAHAN: Update Y terakhir
      }
    },
    { passive: false }
  );
  // --- FIX MULTITOUCH: LOMPAT & LARI ---
  // Menggunakan touchstart langsung agar bisa ditekan bersamaan dengan analog
  const jumpBtn = document.getElementById("jump-btn");
  const runBtn = document.getElementById("run-btn");

  if (jumpBtn) {
    jumpBtn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault(); // Mencegah delay/ghost click
        e.stopPropagation(); // Mencegah konflik dengan swipe kamera
        jump();
      },
      { passive: false }
    );
  }

  if (runBtn) {
    runBtn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRun(true);
      },
      { passive: false }
    );

    runBtn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRun(false);
      },
      { passive: false }
    );
  }
}

function animate() {
  requestAnimationFrame(animate);
  update(clock.getDelta());
  renderer.render(scene, camera);
}
let lastIsLandscape = window.innerWidth > window.innerHeight;
window.addEventListener("resize", () => {
  // TAMBAHKAN PENGECEKAN INI
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  // Deteksi HP diputar (potret <-> landscape): reset pitch kamera biar gak kebawa
  // sudut aneh dari orientasi sebelumnya (lihat catatan minPitch/maxPitch di update()).
  const nowIsLandscape = window.innerWidth > window.innerHeight;
  if (nowIsLandscape !== lastIsLandscape) {
    lastIsLandscape = nowIsLandscape;
    cameraPitch = 0;
  }
});

function openInfo() {
  // Pastikan modal setting tertutup
  document.getElementById("settings-modal").classList.add("hidden");

  // Buka modal info
  const infoModal = document.getElementById("info-modal");
  infoModal.classList.remove("hidden");

  // Pastikan info modal memiliki pointer events (kadang tertutup layer lain)
  infoModal.style.pointerEvents = "auto";
}

// --- LOGIKA POPUP INFO KAPAK ---
function openAxeInfo() {
  // Tutup toko sementara (opsional, atau tumpuk saja)
  // document.getElementById("shop-modal").classList.add("hidden");
  document.getElementById("axe-info-modal").classList.remove("hidden");
}

function closeAxeInfo() {
  document.getElementById("axe-info-modal").classList.add("hidden");
  // Pastikan toko tetap buka jika tadi dibuka dari toko
  // document.getElementById("shop-modal").classList.remove("hidden");
}

// --- HELPER: UPDATE TAMPILAN LOADING SCREEN ---
function updateLoadingUIState() {
  const isCached = localStorage.getItem("rimbaAssetsCached") === "true";

  const elTitle = document.getElementById("loading-title");
  const elDesc = document.getElementById("loading-desc");
  const elIcon = document.getElementById("loading-icon");

  if (isCached) {
    // KONDISI 2: ASET SUDAH ADA (MEMUAT GAME)
    if (elTitle) elTitle.innerText = "MEMUAT DUNIA...";
    if (elDesc)
      elDesc.innerHTML =
        "<i class='fa-solid fa-gamepad'></i> Menyiapkan lingkungan permainan...";
    if (elIcon)
      elIcon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Ikon Loading Putar
  } else {
    // KONDISI 1: PERTAMA KALI (DOWNLOAD)
    if (elTitle) elTitle.innerText = "MENGUNDUH ASET...";
    if (elDesc)
      elDesc.innerHTML =
        "<i class='fa-solid fa-wifi'></i> Mengunduh data agar game bisa dimainkan <b>OFFLINE</b> nanti.";
    if (elIcon)
      elIcon.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i>'; // Ikon Download Awan
  }
}
