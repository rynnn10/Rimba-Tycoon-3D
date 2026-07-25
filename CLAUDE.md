# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Rimba Tycoon" (Penebang Pohon 3D) — browser-based 3D tree-chopping tycoon game. Pure static site: no build step, no package manager, no bundler. All game code lives in `DATA GAME/`.

## Running it

No build/install/test commands exist. Serve `DATA GAME/` with any static file server and open `index.html` (service worker + `fetch` calls require `http://` not `file://`), e.g.:

```
cd "DATA GAME"
npx serve .
```

There is no linter, formatter, or test suite configured.

## Directory layout

- `DATA GAME/` — the actual game (only folder with real code)
  - `index.html` — DOM shell: all screens/modals (start, loading, HUD, shop, settings, stats, sleep) as hidden/shown divs, plus CDN `<script>` tags
  - `game.js` — entire game logic in one file (~2300 lines), plain global functions/state, no modules
  - `style.css` — all styling (Tailwind utility classes are used inline in HTML too)
  - `sw.js` — service worker for offline play
  - `manifest.json` — PWA manifest
  - `assets/` — `.glb` 3D models + textures
  - `sfx/` — `.mp3` sound effects
- `kenney_*` folders (coaster-kit, graveyard-kit, mini-market, pirate-kit, survival-kit) — **unused Kenney.nl asset packs**, kept as raw reference/asset libraries, not wired into the game. Don't assume anything here is imported.

## Tech stack

Loaded via CDN in `index.html`, no npm install:
- Three.js r128 (`three.min.js` + `GLTFLoader.js`, both older non-module `examples/js` builds — global `THREE.*`, not ES imports)
- Tailwind CDN build (utility classes used directly in HTML markup)
- Font Awesome 6.4 for icons

## Architecture (game.js)

Everything is global state + global functions — no classes, no modules, no bundler. Key pieces:

- **`ASSETS`** — map of logical names to `.glb` paths. `AXE_CONFIG` controls the equipped axe's local offset/rotation on the player's hand bone.
- **`state`** — the persisted player save object (wood, coins, axeLevel, axeDamage, stamina, position, camera angle). Saved to `localStorage` under key `penebangSave` via `saveGame()`/`loadSaveData()`, auto-saved periodically while moving/chopping.
- **Boot flow**: `window.onload` checks for existing save → `startGame()` / `continueGame()` → `init()` (once per session) → `loadContent()` (creates a `THREE.LoadingManager`, GLTF-loads player/shop/home/hills/grass/3 tree types/3 axe levels, tracks download progress for the "download for offline" loading screen) → `animate()` render loop calling `update(delta)` each frame.
- **`update(delta)`** is the single per-frame function: jump/gravity physics, joystick+keyboard movement input, run/stamina drain and regen, animation-state priority (chopping > jumping > moving > idle) with `fadeAnimation()` crossfades between `actions["Idle"/"Run"/"Jump"]`, collision against trees/shop/home (`checkCollision`), camera follow (orbit angle/pitch/zoom driven by mouse drag / touch swipe / scroll), grass-hiding transparency effect, then `checkInteractions()` / `updateMinimap()` / `updateTreeHPBar()`.
- **Trees**: 3 tiers (small/medium/large — probabilities 33/33/34%) spawned via `spawnOneTree()` with per-tier HP/reward/collision-radius/interaction-radius/min-gap, placed with rejection sampling to avoid overlap and keep-out zones around spawn/shop/home. `performChop()` deals `state.axeDamage`, plays a manual swing animation via `setInterval` rotation tweening (not the GLTF animation mixer), and on tree death removes it, grants wood, and respawns a new tree after a delay.
- **Axe leveling**: 3 levels, each with its own `.glb`/scale; `changeAxeModel()` hot-swaps the mesh under `handContainer` (attached to the player's `arm-left` bone if present). `upgradeAxe()`/`upgradeStamina()`/`sellWood()` are the shop actions (coin costs scale with current level).
- **Day/night**: `updateRealTimeClock()` runs on a 1s `setInterval`, driven by the real wall-clock hour (18:00–06:00 = night), not in-game time — toggles sky shader colors, sun/hemi light intensity, and fog color.
- **UI**: no framework — all modals/toasts/HUD are direct `document.getElementById` manipulation with `classList`/`style` toggling; `closeModalWithAnimation()` is the shared CSS-transition-then-hide helper.
- **Audio**: `<audio>` elements referenced by DOM id (`sfx-chop`, `sfx-jump`, etc. + `bgm`), volumes controlled via `setBGMVolume()`/`setSFXVolume()` and persisted to `localStorage` separately from the save game.

Most Indonesian-language comments in `game.js` mark incremental patches (`TAMBAHAN` = addition, `PERBAIKAN` = fix) rather than describing stable design — treat them as change-log breadcrumbs, not authoritative docs.

## Working agreement (always follow, every session)

- **Report changes**: after any code edit, tell the user exactly which file(s)/function(s) changed. Never a silent diff.
- **Beep on finish**: after finishing executing a code task, beep 3x on the user's laptop. In PowerShell: `1..3 | ForEach-Object { [console]::beep(1000,300); Start-Sleep -Milliseconds 150 }`.
- **Timestamp every update**: stamp each changed file with a comment header showing day, date, time (WIB), e.g. `// Update terakhir: Kamis, 02/07/2026 10:06 WIB` (same style as `android-app/MainActivity.kt` in the DASHBOARD-TANGKAPAN-NGENGAT reference project). This is NOT just a source comment — the game itself must show a visible footer (in `index.html`, driven by a `GAME_VERSION`/`GAME_UPDATED` constant in `game.js`) with the current version number and last-updated date/time, so the user can see it in the running app (web and APK) without opening the code.
- **Version bump every change** — keep a version string (e.g. a `VERSION` constant) and bump it:
  - patch (`1.0.0` → `1.0.1`): small fix/tweak
  - minor (`1.0.x` → `1.1.0`): medium feature/change
  - major (`1.x.x` → `2.0.0`): big/breaking change
- **Ask before big changes**: for anything major-version-sized (architecture change, removing/replacing a system, new platform target), stop and ask the user first or present options — don't just do it.
- **Report in plain/simple language**: after executing code, summarize results in very simple, easy-to-understand language, and always list which code/files were changed.
