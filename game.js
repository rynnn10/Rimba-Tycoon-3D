// CONFIG
const ASSETS = {
  player: "./assets/character.glb",
  axe: "./assets/kapak.glb",
  tree: "./assets/tree.glb",
  shop: "./assets/toko.glb",
  home: "./assets/house.glb",
  hill1: "./assets/bukit1.glb",
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
const COLLISION_RADII = { shop: 2.0, home: 4.0, tree: 1.5, player: 1.0 };
const INTERACTION_RADII = { shop: 12.0, home: 12.0 };

// GLOBALS
let scene, camera, renderer, clock, loader;
let player, mixer, axeMesh, handContainer;
let actions = {},
  activeAction;
let trees = [],
  hills = [],
  treeModelReference;
let shopArea, homeArea, sunLight, hemiLight, skyMesh;
let isPaused = true;
let gameStarted = false;
let cameraZoom = 1.0;
let touchStartDist = 0;

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

  if (gameStarted) {
    updateHUD();
    updateStaminaUI();
  }

  document.getElementById("start-screen").style.display = "none";
  const loadingScreen = document.getElementById("loading");
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hidden");

  if (!gameStarted) {
    init();
    gameStarted = true;
  } else {
    if (player) {
      player.position.set(0, 0, 0);
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
  document.getElementById("start-screen").style.display = "none";
  const loadingScreen = document.getElementById("loading");

  if (!gameStarted) {
    loadingScreen.style.display = "flex";
    loadingScreen.classList.remove("hidden");
    loadSaveData();
    init();
    gameStarted = true;
  } else {
    document.getElementById("game-ui").classList.remove("hidden");
    isPaused = false;
  }
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

      loader.load(
        ASSETS.axe,
        (axeGltf) => {
          axeMesh = axeGltf.scene;
          axeMesh.scale.set(1, 1, 1);
          axeMesh.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          handContainer.add(axeMesh);
          axeMesh.rotation.set(
            AXE_CONFIG.rotX,
            AXE_CONFIG.rotY,
            AXE_CONFIG.rotZ
          );
          axeMesh.position.set(0, 0, 0);
        },
        undefined,
        onError
      );

      document.getElementById("loading").style.display = "none";
      document.getElementById("game-ui").classList.remove("hidden");
      isPaused = false;
      const bgmAudio = document.getElementById("bgm");
      if (bgmAudio.volume > 0) {
        bgmAudio.play().catch((e) => {});
      }
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

  loader.load(
    ASSETS.tree,
    (gltf) => {
      treeModelReference = gltf.scene;
      spawnInitialTrees();
    },
    undefined,
    (e) => console.warn("Tree gagal load", e)
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
  const btn = document.getElementById("btn-mute-sfx");
  const slider = document.getElementById("sfx-slider");

  if (isSFXMuted) {
    lastSFXVol = parseFloat(slider.value) || 1.0;
    slider.value = 0;
    setSFXVolume(0);
    btn.innerHTML = '<i class="fa-solid fa-volume-xmark text-red-500"></i> OFF';
  } else {
    const target = lastSFXVol > 0 ? lastSFXVol : 1.0;
    slider.value = target;
    setSFXVolume(target);
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

function setBGMVolume(val) {
  document.getElementById("bgm").volume = val;
  if (isBGMMuted && val > 0) {
    isBGMMuted = false;
    document.getElementById("btn-mute-bgm").innerHTML =
      '<i class="fa-solid fa-volume-high"></i> ON';
  }
}

function setSFXVolume(val) {
  ["sfx-chop", "sfx-jump", "sfx-step", "sfx-coin", "sfx-fail"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.volume = val;
  });
  if (isSFXMuted && val > 0) {
    isSFXMuted = false;
    document.getElementById("btn-mute-sfx").innerHTML =
      '<i class="fa-solid fa-volume-high"></i> ON';
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
  isPaused = true;
  document.getElementById("settings-modal").classList.add("hidden");
  document.getElementById("game-ui").classList.add("hidden");
  document.getElementById("start-screen").style.display = "flex";
  document.getElementById("bgm").pause();
}

function openSettings() {
  isPaused = true;
  document.getElementById("settings-modal").classList.remove("hidden");
}
function closeSettings() {
  isPaused = false;
  document.getElementById("settings-modal").classList.add("hidden");
}
function openStats() {
  document.getElementById("settings-modal").classList.add("hidden");
  document.getElementById("stats-modal").classList.remove("hidden");
  document.getElementById("stat-axe-lvl").innerText = "Lv. " + state.axeLevel;
  document.getElementById("stat-dmg").innerText = state.axeDamage + " Hit";
  document.getElementById("stat-stamina").innerText =
    Math.floor(state.stamina) + " / " + state.maxStamina;
  document.getElementById("stat-coins").innerText = state.coins;
  document.getElementById("stat-wood").innerText = state.wood;
}
function closeStats() {
  document.getElementById("stats-modal").classList.add("hidden");
  document.getElementById("settings-modal").classList.remove("hidden");
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

  setupLighting();
  createEnvironment();
  setupControls();

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
  if (!treeModelReference) return;
  for (let i = 0; i < 45; i++) {
    spawnOneTree();
  }
}
function spawnOneTree() {
  const tree = treeModelReference.clone();
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
    let tooClose = false;
    for (let t of trees) {
      if (posVec.distanceTo(t.position) < 4) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) validPos = true;
  }
  if (validPos) {
    tree.position.set(tx, 0, tz);
    tree.scale.set(3.8, 3.8, 3.8);
    tree.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    tree.userData = { hp: 3 * state.axeLevel, maxHp: 3 * state.axeLevel };
    scene.add(tree);
    trees.push(tree);
  }
}

function update(delta) {
  if (isPaused) return;
  if (!player) return;
  if (mixer) mixer.update(delta);

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

  let dx = joystick.x,
    dz = joystick.y;
  if (keys.ArrowUp) dz -= 1;
  if (keys.ArrowDown) dz += 1;
  if (keys.ArrowLeft) dx -= 1;
  if (keys.ArrowRight) dx += 1;
  if (keys.Space) jump();
  if (keys.Shift) toggleRun(true);
  else if (!("ontouchstart" in window)) toggleRun(false);

  let currentSpeed = WALK_SPEED;
  if (isRunning && (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1)) {
    if (state.stamina > 0) {
      currentSpeed = RUN_SPEED;
      state.stamina -= 0.1;
      if (state.stamina < 0) state.stamina = 0;
      if (actions["Run"]) actions["Run"].timeScale = 2.0;
      if (Math.random() < 0.1) createDust(player.position);
      player.rotation.x = 0.2;
    } else {
      isRunning = false;
      showToast("Lelah... Butuh istirahat!", "error");
    }
  } else {
    if (state.stamina < state.maxStamina) state.stamina += 0.05;
    if (actions["Run"]) actions["Run"].timeScale = 1.0;
    player.rotation.x = 0;
  }
  updateStaminaUI();

  const speed = currentSpeed * delta;
  if (!state.isChopping) {
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
      const nextX = player.position.x + dx * speed;
      const nextZ = player.position.z + dz * speed;
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
      player.rotation.y = Math.atan2(dx, dz);
      if (activeAction !== actions["Run"] && actions["Run"]) {
        activeAction.fadeOut(0.2);
        actions["Run"].reset().fadeIn(0.2).play();
        activeAction = actions["Run"];
      }
    } else {
      if (activeAction !== actions["Idle"] && actions["Idle"]) {
        activeAction.fadeOut(0.2);
        actions["Idle"].reset().fadeIn(0.2).play();
        activeAction = actions["Idle"];
      }
    }
  }

  const baseOffsetY = 14;
  const baseOffsetZ = 16;
  const camTarget = new THREE.Vector3(
    player.position.x,
    player.position.y + baseOffsetY * cameraZoom,
    player.position.z + baseOffsetZ * cameraZoom
  );
  camera.position.lerp(camTarget, 0.08);
  camera.lookAt(player.position.x, 0, player.position.z);

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
    const distTree = Math.sqrt(
      (nextX - t.position.x) ** 2 + (nextZ - t.position.z) ** 2
    );
    if (distTree < COLLISION_RADII.tree) return true;
  }
  return false;
}

function toggleRun(isPressed) {
  if (isPressed) {
    if (state.stamina > 0) isRunning = true;
    else showToast("Terlalu Lelah!", "error");
  } else isRunning = false;
  const btn = document.getElementById("run-btn");
  if (isRunning) {
    btn.classList.add("active");
    document.getElementById("sfx-step").play();
  } else {
    btn.classList.remove("active");
    document.getElementById("sfx-step").pause();
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
  if (!isJumping && player) {
    yVelocity = JUMP_FORCE;
    isJumping = true;
    playSound("sfx-jump");
  }
}

function checkInteractions() {
  const chopBtn = document.getElementById("action-btn");
  const sleepBtn = document.getElementById("sleep-btn");
  state.nearShop =
    player.position.distanceTo(shopArea.position) < INTERACTION_RADII.shop;
  state.nearHome =
    player.position.distanceTo(homeArea.position) < INTERACTION_RADII.home;
  let closestTree = null,
    minDist = 2.0;
  trees.forEach((t) => {
    const d = player.position.distanceTo(t.position);
    if (d < minDist) {
      minDist = d;
      closestTree = t;
    }
  });
  state.nearTree = closestTree;
  chopBtn.classList.add("hidden");
  sleepBtn.classList.add("hidden");
  if (state.nearShop) {
    chopBtn.classList.remove("hidden");
    chopBtn.innerHTML = "💰";
    chopBtn.style.background = "linear-gradient(135deg, #f1c40f, #f39c12)";
  } else if (state.nearTree) {
    chopBtn.classList.remove("hidden");
    chopBtn.innerHTML = "🪓";
    chopBtn.style.background = "linear-gradient(135deg, #e67e22, #d35400)";
  } else if (state.nearHome && state.isNight) {
    sleepBtn.classList.remove("hidden");
  }
}

function handleAction() {
  if (state.nearShop) openShop();
  else if (state.nearTree && !state.isChopping) performChop(state.nearTree);
}

function performChop(tree) {
  if (state.stamina < 10) {
    showToast("Terlalu Lelah!", "error");
    return;
  }
  state.stamina -= 10;
  updateStaminaUI();
  state.isChopping = true;
  playSound("sfx-chop");
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
      scene.remove(tree);
      trees = trees.filter((t) => t !== tree);
      state.wood += 2;
      showToast("+2 Kayu", "success");
      updateHUD();
      state.nearTree = null;
      saveGame();
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
  document.getElementById("shop-stock").innerText = state.wood;
  document.getElementById("axe-lvl").innerText = state.axeLevel;
  document.getElementById("axe-dmg").innerText = state.axeDamage;
  document.getElementById("upgrade-cost").innerText = state.axeLevel * 50;
  document.getElementById("stamina-cost").innerText =
    100 + (state.maxStamina - 100) * 2;
  document.getElementById("max-stamina-disp").innerText = state.maxStamina;
  document.getElementById("shop-modal").classList.remove("hidden");
}
function closeShop() {
  document.getElementById("shop-modal").classList.add("hidden");
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
function upgradeAxe() {
  const cost = state.axeLevel * 50;
  if (state.coins >= cost) {
    state.coins -= cost;
    state.axeLevel++;
    state.axeDamage += 1;
    if (axeMesh) axeMesh.scale.multiplyScalar(1.1);
    updateHUD();
    closeShop();
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
    closeShop();
    showToast(`Stamina Diupgrade! Max: ${state.maxStamina}`, "success");
    playSound("sfx-coin");
    saveGame();
  } else {
    closeShop();
    showToast("Koin kurang!", "error");
    playSound("sfx-fail");
  }
}

function sleep() {
  const overlay = document.createElement("div");
  overlay.style =
    "position:fixed;inset:0;background:black;z-index:99;opacity:0;transition:opacity 1s;";
  document.body.appendChild(overlay);
  setTimeout(() => (overlay.style.opacity = 1), 10);
  setTimeout(() => {
    state.isNight = false;
    state.stamina = state.maxStamina;
    updateStaminaUI();
    saveGame();
    skyMesh.material.uniforms.topColor.value.setHex(0x0077ff);
    skyMesh.material.uniforms.bottomColor.value.setHex(0xffffff);
    sunLight.intensity = 1.2;
    hemiLight.intensity = 0.6;
    scene.fog.color.setHex(0x87ceeb);
    showToast("Bangun pagi! Stamina Pulih.", "info");
    overlay.style.opacity = 0;
    setTimeout(() => overlay.remove(), 1000);
  }, 2000);
}

function updateHUD() {
  document.getElementById("wood-val").innerText = state.wood;
  document.getElementById("coin-val").innerText = state.coins;
}
function updateStaminaUI() {
  const fill = document.getElementById("stamina-bar");
  const text = document.getElementById("stamina-text");
  const pct = (state.stamina / state.maxStamina) * 100;
  fill.style.width = pct + "%";
  text.innerText = Math.floor(state.stamina) + "/" + state.maxStamina;
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
  map.innerHTML = "";
  const mapRadius = 50,
    mapScale = 0.5,
    cx = 50,
    cy = 50;
  const actualW = map.clientWidth;
  const center = actualW / 2;
  const addDot = (x, z, color, size = "map-dot", isPlayer = false) => {
    let dx = (x - player.position.x) * mapScale;
    let dy = (z - player.position.z) * mapScale;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = center - 4;
    if (dist > maxDist) {
      if (isPlayer) return;
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxDist;
      dy = Math.sin(angle) * maxDist;
    }
    const el = document.createElement("div");
    el.className = size;
    el.style.backgroundColor = color;
    el.style.left = center + dx + "px";
    el.style.top = center + dy + "px";
    map.appendChild(el);
  };
  const pEl = document.createElement("div");
  pEl.className = "map-dot map-player";
  pEl.style.left = center + "px";
  pEl.style.top = center + "px";
  map.appendChild(pEl);
  addDot(shopArea.position.x, shopArea.position.z, "#f1c40f");
  addDot(homeArea.position.x, homeArea.position.z, "#3498db");
  trees.forEach((t) => addDot(t.position.x, t.position.z, "#e74c3c"));
}

function updateTreeHPBar() {
  const barContainer = document.getElementById("tree-hp-container");
  const barFill = document.getElementById("tree-hp-bar");
  if (state.nearTree) {
    const tree = state.nearTree;
    const vec = tree.position
      .clone()
      .add(new THREE.Vector3(0, 7, 0))
      .project(camera);
    if (vec.z > 1 || Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) {
      barContainer.style.display = "none";
      return;
    }
    barContainer.style.display = "block";
    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vec.y * 0.5) + 0.5) * window.innerHeight;
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
    state.wood = data.wood || 0;
    state.coins = data.coins || 0;
    state.axeLevel = data.axeLevel || 1;
    state.axeDamage = data.axeDamage || 1;
    state.maxStamina = data.maxStamina || 100;
    state.stamina = data.stamina || state.maxStamina;
    updateHUD();
    updateStaminaUI();
  }
}
function saveGame() {
  localStorage.setItem("penebangSave", JSON.stringify(state));
}

function setupControls() {
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
  if ("ontouchstart" in window) {
    const jWrapper = document.getElementById("joystick-wrapper");
    const jStick = document.getElementById("joystick-stick");
    jWrapper.style.display = "block";
    jWrapper.addEventListener("touchstart", (e) => {
      joystick.active = true;
      joystick.originX = e.touches[0].clientX;
      joystick.originY = e.touches[0].clientY;
    });
    jWrapper.addEventListener("touchmove", (e) => {
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
    jWrapper.addEventListener("touchend", () => {
      joystick.active = false;
      joystick.x = 0;
      joystick.y = 0;
      jStick.style.transform = `translate(-50%,-50%)`;
    });
    const runBtn = document.getElementById("run-btn");
    runBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      toggleRun(true);
    });
    runBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      toggleRun(false);
    });
  }

  document.addEventListener(
    "wheel",
    (e) => {
      if (!gameStarted || isPaused) return;
      const zoomSpeed = 0.001;
      cameraZoom += e.deltaY * zoomSpeed;
      cameraZoom = Math.max(0.6, Math.min(1.6, cameraZoom));
      console.log("Zoom Desktop (Wheel):", cameraZoom.toFixed(2));
    },
    { passive: false }
  );

  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        touchStartDist = Math.hypot(dx, dy);
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        const dist = Math.hypot(dx, dy);
        const diff = touchStartDist - dist;
        const sensitivity = 0.005;
        cameraZoom += diff * sensitivity;
        cameraZoom = Math.max(0.6, Math.min(1.6, cameraZoom));
        touchStartDist = dist;
        console.log("Zoom Mobile (Pinch):", cameraZoom.toFixed(2));
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
