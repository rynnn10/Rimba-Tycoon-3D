// CONFIG
const ASSETS = {
  player: "./assets/character.glb",
  axe: "./assets/kapak.glb", // Level 1
  axe2: "./assets/kapakup.glb", // Level 2 (BARU)
  axe3: "./assets/kapak3.glb", // Level 3 (BARU)
  tree1: "./assets/tree.glb", // Pohon 1 (Lama)
  tree2: "./assets/pohon2.glb", // Pohon 2 (Baru - Ganti path jika ada file lain)
  tree3: "./assets/tree-tall.glb", // Pohon 3 (Baru - Ganti path jika ada file lain)
  shop: "./assets/toko.glb",
  home: "./assets/house.glb",
  hill1: "./assets/bukit1.glb",
  grass1: "./assets/rumput1.glb", // Rumput Kecil (Hiasan)
  grass2: "./assets/rumput2.glb", // Rumput Besar (Bisa Sembunyi)
};
const AXE_CONFIG = {
  x: 0.2,
  y: 0.1,
  z: 0,
  rotX: Math.PI / 2,
  rotY: Math.PI,
  rotZ: 0,
};

const MAP_RADIUS_COLLISION = 140;
const HILL_VISUAL_RADIUS = 163;
const COLLISION_RADII = { shop: 3.5, home: 5.5, tree: 2.5, player: 1.0 };
const INTERACTION_RADII = { shop: 12.0, home: 12.0 };

// GLOBALS
const MAX_AXE_LEVEL = 3; // --- TAMBAHAN KONSTANTA ---
let staminaRegenTimer = 0; // Timer penunda regenerasi stamina
let autoSaveTimer = 0; // <--- TAMBAHKAN INI (Untuk hitung waktu save saat jalan)
let scene, camera, renderer, clock, loader;
let player, mixer, axeMesh, handContainer;
let actions = {},
  activeAction;
let trees = [],
  hills = [];
grasses = []; // Array untuk rumput besar (untuk logika sembunyi)
let treeModels = { type1: null, type2: null, type3: null };
let shopArea, homeArea, sunLight, hemiLight, skyMesh;
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
// ---------------------

// Physics
let yVelocity = 0,
  isJumping = false,
  isRunning = false;
const GRAVITY = 0.05,
  JUMP_FORCE = 0.65,
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
  coins: 0,
  axeLevel: 1,
  axeDamage: 1,
  stamina: 100,
  maxStamina: 100,
  nearTree: null,
  nearShop: false,
  nearHome: false,
  isChopping: false,
  isNight: false,
};

let pendingSaveData = null; // Variabel sementara untuk menyimpan data posisi saat load

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
    coins: 0,
    axeLevel: 1,
    axeDamage: 1,
    stamina: 100,
    maxStamina: 100,
    nearTree: null,
    nearShop: false,
    nearHome: false,
    isChopping: false,
    isNight: false,
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

// --- LOADING CONTENT ---
function loadContent() {
  const onError = (error) => {
    console.error("Gagal memuat aset:", error);
    document.getElementById("loading").style.display = "none";
    document.getElementById("game-ui").classList.remove("hidden");
    isPaused = false;
    alert("Terjadi kesalahan memuat aset 3D. Cek Console.");
  };

  loader.load(
    ASSETS.player,
    (gltf) => {
      player = gltf.scene;
      player.scale.set(2.0, 2.0, 2.0);
      if (pendingSaveData) {
        player.position.set(pendingSaveData.pos.x, 0, pendingSaveData.pos.z);
        player.rotation.y = pendingSaveData.pos.rot;
        cameraAngle = pendingSaveData.camAngle; // Kembalikan sudut kamera
        pendingSaveData = null; // Reset setelah dipakai
      } else {
        // Jika game baru
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
      const leftArmBone = player.getObjectByName("arm-left");
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
        actions["Idle"].play();
        activeAction = actions["Idle"];
      }

      const bgmAudio = document.getElementById("bgm");
      document.getElementById("loading").style.display = "none";
      document.getElementById("game-ui").classList.remove("hidden");
      isPaused = false;
      if (bgmAudio.volume > 0) {
        bgmAudio.play().catch((e) => {});
      }

      // --- UPDATE: Load Kapak Sesuai Level Saat Ini ---
      let currentAxeAsset = ASSETS.axe; // Default Lv 1
      let currentScale = 1.0;

      // Cek state level dari save data
      if (state.axeLevel === 2) {
        currentAxeAsset = ASSETS.axe2;
        currentScale = 1.2;
      } else if (state.axeLevel >= 3) {
        currentAxeAsset = ASSETS.axe3;
        currentScale = 1.5;
      }

      loader.load(
        currentAxeAsset,
        (axeGltf) => {
          axeMesh = axeGltf.scene;
          axeMesh.scale.set(currentScale, currentScale, currentScale); // Skala sesuai level
          axeMesh.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });

          // Reset rotasi & posisi
          axeMesh.rotation.set(
            AXE_CONFIG.rotX,
            AXE_CONFIG.rotY,
            AXE_CONFIG.rotZ
          );
          axeMesh.position.set(0, 0, 0);

          handContainer.add(axeMesh);
        },
        undefined,
        (e) => console.warn("Gagal load kapak level " + state.axeLevel, e)
      );
      // -----------------------------------------------------
    },
    undefined,
    onError
  );

  loader.load(
    ASSETS.shop,
    (gltf) => {
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
    },
    undefined,
    (e) => console.warn("Shop gagal load", e)
  );

  loader.load(
    ASSETS.home,
    (gltf) => {
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
    },
    undefined,
    (e) => console.warn("Home gagal load", e)
  );

  loader.load(
    ASSETS.hill1,
    (gltf) => {
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
    },
    undefined,
    (e) => console.warn("Hill gagal load", e)
  );

  // --- LOADER RUMPUT ---
  // 1. Rumput Kecil (Hiasan - Banyak)
  loader.load(
    ASSETS.grass1,
    (gltf) => {
      const model = gltf.scene;

      // PERBAIKAN WARNA: Paksa jadi hijau jika modelnya putih/polos
      model.traverse((o) => {
        if (o.isMesh) {
          // Warna hijau rumput (Hex: 0x4caf50)
          o.material.color.setHex(0x4caf50);
        }
      });

      for (let i = 0; i < 100; i++) {
        const g = model.clone();
        const dist = Math.random() * MAP_RADIUS_COLLISION;
        const angle = Math.random() * Math.PI * 2;
        g.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

        // UPDATE UKURAN: Diperbesar dari 1.5 ke 2.5
        g.scale.set(4.5, 4.5, 4.5);

        g.rotation.y = Math.random() * Math.PI;
        scene.add(g);
      }
    },
    undefined,
    (e) => console.warn("Grass1 (Kecil) gagal load", e)
  );

  // 2. Rumput Besar (Tempat Sembunyi - Lebih Sedikit)
  loader.load(
    ASSETS.grass2,
    (gltf) => {
      const model = gltf.scene;

      // PERBAIKAN WARNA: Paksa jadi hijau tua
      model.traverse((o) => {
        if (o.isMesh) {
          o.material.color.setHex(0x388e3c);
        }
      });

      for (let i = 0; i < 40; i++) {
        const g = model.clone();
        const dist = Math.random() * MAP_RADIUS_COLLISION;
        const angle = Math.random() * Math.PI * 2;
        g.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

        // UPDATE UKURAN: Diperbesar dari 2.5 ke 4.5
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
    },
    undefined,
    (e) => console.warn("Grass2 (Besar) gagal load", e)
  );

  // --- GANTI LOGIKA LOAD POHON DENGAN INI ---
  let treesToLoad = 3; // Total 3 pohon
  function onTreeLoaded() {
    treesToLoad--;
    if (treesToLoad === 0) {
      spawnInitialTrees();
    }
  }

  // 1. Load Pohon Lama
  loader.load(
    ASSETS.tree1,
    (gltf) => {
      treeModels.type1 = gltf.scene;
      onTreeLoaded();
    },
    undefined,
    onError
  );

  // 2. Load Pohon Baru 1
  loader.load(
    ASSETS.tree2,
    (gltf) => {
      treeModels.type2 = gltf.scene;
      onTreeLoaded();
    },
    undefined,
    onError
  );

  // 3. Load Pohon Baru 2
  loader.load(
    ASSETS.tree3,
    (gltf) => {
      treeModels.type3 = gltf.scene;
      onTreeLoaded();
    },
    undefined,
    onError
  );
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
  isSFXMuted = !isSFXMuted;
  localStorage.setItem("rimbaMuteSFX", isSFXMuted);

  if (isSFXMuted) {
    // Matikan suara jalan jika sedang bunyi
    const sfxStep = document.getElementById("sfx-step");
    if (sfxStep) {
      sfxStep.pause();
      sfxStep.currentTime = 0;
    }

    // TAMBAHKAN INI: Matikan suara lari jika sedang bunyi
    const sfxRun = document.getElementById("sfx-run");
    if (sfxRun) {
      sfxRun.pause();
      sfxRun.currentTime = 0;
    }

    showToast("Efek Mati", "error");
  } else {
    // Logika untuk menyalakan kembali akan diatur oleh update() berdasarkan pergerakan
    showToast("Efek Nyala", "success");
  }
  updateSettingsUI();
}

// --- TAMBAHKAN FUNGSI INI AGAR EROR HILANG ---
function loadSettings() {
  // Load BGM Volume
  const savedBGM = localStorage.getItem("rimbaBGMVolume");
  if (savedBGM !== null) {
    setBGMVolume(savedBGM);
  }

  // Load SFX Volume
  const savedSFX = localStorage.getItem("rimbaSFXVolume");
  if (savedSFX !== null) {
    setSFXVolume(savedSFX);
  }

  // Load Mute State (Optional)
  const savedMuteSFX = localStorage.getItem("rimbaMuteSFX");
  if (savedMuteSFX === "true") {
    toggleSFX(); // Matikan jika tersimpan mati
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

// GANTI FUNCTION setSFXVolume
function setSFXVolume(val) {
  const sfxVol = parseFloat(val);
  if (isNaN(sfxVol)) return;

  // Update daftar audio
  document.getElementById("sfx-chop").volume = sfxVol;
  document.getElementById("sfx-jump").volume = sfxVol;
  document.getElementById("sfx-coin").volume = sfxVol;
  document.getElementById("sfx-fail").volume = sfxVol;
  document.getElementById("sfx-fall").volume = sfxVol;
  document.getElementById("sfx-step").volume = sfxVol;
  document.getElementById("sfx-run").volume = sfxVol; // TAMBAHKAN INI

  localStorage.setItem("rimbaSFXVolume", sfxVol);

  // Update UI Slider
  const sfxSlider = document.getElementById("sfx-slider");
  if (sfxSlider) sfxSlider.value = val;

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

  // --- FIX: Cek elemen sebelum diisi datanya ---
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
  // -------------------------------------------

  // Update Gambar Kapak di Stats
  const statAxeImg = document.getElementById("stat-axe-img");
  if (statAxeImg) {
    let imgPath = "assets/kapak.png";
    if (state.axeLevel === 2) imgPath = "assets/kapak.png";
    if (state.axeLevel >= 3) imgPath = "assets/kapak.png";
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
    if (posVec.distanceTo(shopArea.position) < 25) continue;
    if (posVec.distanceTo(homeArea.position) < 25) continue;
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
    tree.position.set(tx, 0, tz);
    tree.scale.set(conf.scale, conf.scale, conf.scale);
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
      reward: conf.reward,
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
      if (distFromCenter < MAP_RADIUS_COLLISION) {
        if (!checkCollision(nextX, nextZ)) {
          player.position.x = nextX;
          player.position.z = nextZ;
        }
      } else {
        const angle = Math.atan2(nextZ, nextX);
        player.position.x = Math.cos(angle) * (MAP_RADIUS_COLLISION - 0.5);
        player.position.z = Math.sin(angle) * (MAP_RADIUS_COLLISION - 0.5);
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
  const minPitch = -baseHeight + 2;
  const maxPitch = 20;
  cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
  const totalHeight = baseHeight + cameraPitch;
  const offsetX = Math.sin(cameraAngle) * baseDist * cameraZoom;
  const offsetZ = Math.cos(cameraAngle) * baseDist * cameraZoom;
  const offsetY = totalHeight * cameraZoom;
  const camTarget = new THREE.Vector3(
    player.position.x + offsetX,
    player.position.y + offsetY,
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

  // 2. LOGIKA TOMBOL (DIPERBAIKI ID-NYA)
  const actionBtn = document.getElementById("action-btn");
  const shopBtn = document.getElementById("btn-shop"); // Pastikan ID ini ada di HTML jika dipakai
  const sleepBtn = document.getElementById("btn-sleep"); // Pastikan ID ini ada di HTML jika dipakai

  if (actionBtn) {
    // Reset state tombol
    let showAction = false;
    let icon = "";
    let actionFunc = null;

    // Prioritas 1: Toko
    const distShop = player.position.distanceTo(shopArea.position);
    if (distShop < INTERACTION_RADII.shop) {
      state.nearShop = true;
      showAction = true;
      icon = "🛒"; // Icon Toko
      actionFunc = openShop;
    } else {
      state.nearShop = false;
    }

    // Prioritas 2: Pohon (Jika tidak dekat toko)
    if (!showAction && state.nearTree) {
      showAction = true;
      icon = "🪓"; // Icon Kapak
      actionFunc = () => performChop(state.nearTree);
    }

    // Terapkan ke tombol
    if (showAction) {
      actionBtn.classList.remove("hidden");
      actionBtn.classList.add("animate-bounce");
      actionBtn.innerText = icon;

      // Update handler klik secara dinamis
      actionBtn.onclick = actionFunc;
    } else {
      // Cek interaksi rumah terpisah karena tombolnya beda (btn-sleep)
      actionBtn.classList.add("hidden");
      actionBtn.classList.remove("animate-bounce");
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
}

function performChop(tree) {
  // 1. Tentukan Biaya Stamina Berdasarkan Tipe Pohon (Ukuran/MaxHP)
  // Pohon Kecil (HP 3) -> Biaya 3
  // Pohon Sedang (HP 6) -> Biaya 5
  // Pohon Besar (HP 15) -> Biaya 8
  let staminaCost = 3;
  if (tree.userData.maxHp >= 15) staminaCost = 8;
  else if (tree.userData.maxHp >= 6) staminaCost = 5;

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

  // Animasi mengayun
  const initRot = player.rotation.y;
  let f = 0;
  const inter = setInterval(() => {
    f++;
    player.rotation.y += f < 5 ? 0.3 : -0.3;
    if (f > 10) {
      clearInterval(inter);
      player.rotation.y = initRot;
      onChopFinish();
    }
  }, 30);

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
      showToast(`+${reward} Kayu`, "success");

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
  // Update Data Teks (TETAP SAMA)
  document.getElementById("shop-stock").innerText = state.wood;
  document.getElementById("axe-lvl").innerText = state.axeLevel;
  document.getElementById("axe-dmg").innerText = state.axeDamage;
  document.getElementById("max-stamina-disp").innerText = state.maxStamina;
  document.getElementById("axe-lvl-next").innerText = state.axeLevel + 1;
  document.getElementById("axe-dmg-next").innerText = state.axeDamage + 1;
  document.getElementById("upgrade-cost").innerText = state.axeLevel * 50;
  document.getElementById("stamina-cost").innerText =
    100 + (state.maxStamina - 100) * 2;

  // Update Visual Kapak Sesuai Level Saat Ini (TETAP SAMA LOGIKANYA)
  const imgEl = document.getElementById("shop-axe-current-img");
  if (imgEl) {
    if (state.axeLevel === 1) imgEl.src = "assets/kapak.png";
    else if (state.axeLevel === 2) imgEl.src = "assets/kapakup.png";
    else if (state.axeLevel >= 3) imgEl.src = "assets/kapak3.png";
  }

  // --- TAMBAHAN LOGIKA HANDLE KAPAK MAX (LEVEL 3) ---
  const upgradeCostSpan = document.getElementById("upgrade-cost");
  if (upgradeCostSpan) {
    // Jika sudah level maksimal (Level 3)
    if (state.axeLevel >= MAX_AXE_LEVEL) {
      document.getElementById("axe-lvl-next").innerText = "MAX";
      document.getElementById("axe-dmg-next").innerText = "MAX";

      // UPDATE TOMBOL: Ganti koin & harga jadi "MAX"
      // Kita perlu akses parent untuk manipulasi HTML tombol agar ikon koin hilang
      const upgradeBtn = upgradeCostSpan.closest("button");
      if (upgradeBtn) {
        upgradeBtn.innerHTML = "UPGRADE <br> MAX"; // Ikon koin & span harga hilang murni teks "MAX"

        // Tambahkan style disable visual via Tailwind jika belum ada di CSS
        upgradeBtn.disabled = true; // Disable fungsional
        upgradeBtn.classList.remove(
          "bg-orange-500",
          "hover:bg-orange-600",
          "active:scale-95"
        );
        upgradeBtn.classList.add("bg-gray-400", "cursor-not-allowed"); // Grayed out & cursor
      }
    } else {
      // Belum Max, pastikan tombol upgrade kembali normal (reset jika pernah MAX)
      const upgradeBtn = upgradeCostSpan.closest("button");
      if (upgradeBtn) {
        // Reset HTML tombol (Pastikan ID upgrade-cost ada lagi)
        upgradeBtn.innerHTML = `UPGRADE <br><span id="upgrade-cost">${
          state.axeLevel * 50
        }</span>💰`;

        upgradeBtn.disabled = false;
        upgradeBtn.classList.add(
          "bg-orange-500",
          "hover:bg-orange-600",
          "active:scale-95"
        );
        upgradeBtn.classList.remove("bg-gray-400", "cursor-not-allowed");
      }
    }
  }
  // ----------------------------------------------------

  // Buka Modal Toko
  document.getElementById("shop-modal").classList.remove("hidden");
}

function exitApp() {
  saveGame(); // Simpan dulu sebelum keluar

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
  // Ganti penutupan langsung dengan animasi
  closeModalWithAnimation("shop-modal");
}

// FUNGSI BARU: Mengganti model kapak secara visual
function changeAxeModel(level) {
  if (!handContainer) return;

  // 1. Hapus kapak lama
  if (axeMesh) {
    handContainer.remove(axeMesh);
    axeMesh = null; // Bersihkan referensi
  }

  // 2. Tentukan aset berdasarkan level
  let assetUrl = ASSETS.axe;
  let scale = 1;

  if (level === 2) {
    assetUrl = ASSETS.axe2;
    scale = 1.2;
  } else if (level >= 3) {
    assetUrl = ASSETS.axe3;
    scale = 1.5;
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
    axeMesh.position.set(0, 0, 0);

    handContainer.add(axeMesh);
    console.log("Visual Kapak Updated ke Level " + level);
  });
}

function upgradeAxe() {
  // Cek Max Level (Misal Max Lv 3)
  if (state.axeLevel >= 3) {
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

function sellWood() {
  if (state.wood > 0) {
    const earn = state.wood * 5;
    state.coins += earn;
    state.wood = 0;
    updateHUD();
    closeShop();
    showToast(`Terjual! +${earn} Koin`, "success");
    playSound("sfx-coin");
    saveGame();
  } else {
    closeShop();
    showToast("Kayu habis!", "error");
    playSound("sfx-fail");
  }
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
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
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

  // --- 3. TAMBAHKAN POHON (TIDAK CLAMPED) ---
  trees.forEach((t) => addDot(t.position.x, t.position.z, "#e74c3c", false));
}

function updateTreeHPBar() {
  const barContainer = document.getElementById("tree-hp-container");
  const barFill = document.getElementById("tree-hp-bar");

  if (state.nearTree) {
    const tree = state.nearTree;

    // UPDATE: Turunkan offset Y dari 7 ke 3.5 (Lebih dekat ke pemain)
    const vec = tree.position
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

    const pct = (tree.userData.hp / tree.userData.maxHp) * 100;
    barFill.style.width = pct + "%";
  } else {
    barContainer.style.display = "none";
  }
}

function loadSaveData() {
  const saved = localStorage.getItem("penebangSave");
  if (saved) {
    const data = JSON.parse(saved);

    // Kembalikan data lama
    state.wood = parseInt(data.wood) || 0;
    state.coins = parseInt(data.coins) || 0;
    state.axeLevel = parseInt(data.axeLevel) || 1; // Load level kapak
    state.axeDamage = parseInt(data.axeDamage) || 1;
    state.maxStamina = parseInt(data.maxStamina) || 100;

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

  // 2. Kontrol Joystick (Tetap sama, tapi kita tambah logic agar tidak tabrakan dengan swipe kamera)
  if ("ontouchstart" in window) {
    const jWrapper = document.getElementById("joystick-wrapper");
    const jStick = document.getElementById("joystick-stick");
    jWrapper.style.display = "block";

    jWrapper.addEventListener("touchstart", (e) => {
      // Stop event bubbling agar tidak dianggap swipe kamera
      e.stopPropagation();
      joystick.active = true;
      joystick.originX = e.touches[0].clientX;
      joystick.originY = e.touches[0].clientY;
    });

    jWrapper.addEventListener("touchmove", (e) => {
      e.stopPropagation();
      if (!joystick.active) return;
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
    });

    jWrapper.addEventListener("touchend", (e) => {
      e.stopPropagation();
      joystick.active = false;
      joystick.x = 0;
      joystick.y = 0;
      jStick.style.transform = `translate(-50%,-50%)`;
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

        // TAMBAHAN: Ubah pitch berdasarkan swipe Y
        cameraPitch += deltaY * 0.05;

        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY; // TAMBAHAN: Update Y terakhir
      }
    },
    { passive: false }
  );
}

function animate() {
  requestAnimationFrame(animate);
  update(clock.getDelta());
  renderer.render(scene, camera);
}
window.addEventListener("resize", () => {
  // TAMBAHKAN PENGECEKAN INI
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
