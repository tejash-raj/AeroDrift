# AeroDrift

[![CI](https://github.com/YOUR-GITHUB-USERNAME/aerodrift-game/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR-GITHUB-USERNAME/aerodrift-game/actions/workflows/ci.yml)

**A zero-install 3D arcade shooter for desktop and mobile browsers.**
The moon has shattered and its fragments are falling into Earth's oceans. You fly the last line of defence, just above the waves.

**▶ Play:** https://YOUR-DEPLOYMENT.vercel.app · **Case study:** [CASE_STUDY.md](./CASE_STUDY.md)

![AeroDrift gameplay](./public/og-image.png)

Designed and developed by **Tejash Raj**, M.Des, IIT Guwahati · [Portfolio](https://www.behance.net/tejashraj)

---

## Features

- **Three ships with clear trade-offs.** Interceptor (fast, fragile, ×1.5 score), Defender (balanced, ×1.2) and Juggernaut (armoured, twin cannons).
- **A difficulty curve.** Every 30 seconds starts a new sector: more enemies, faster flight, more saucers.
- **Combo multiplier up to ×5** for chaining kills, with a visible timer.
- **Fair collisions.** Hitboxes match what you see. Ramming is forgiving, shooting is generous, and a short invulnerability window follows every hit.
- **Responsive feedback.** Trauma-based screen shake, damage vignette, hit and kill markers, score pops, engine flame, FOV kick on boost, and haptics on Android.
- **Touch-first mobile controls.** A floating analog stick, hold-to-fire and hold-to-boost buttons that can't get stuck, and a HUD laid out around the thumbs.
- **Accessibility.** Reduce-motion mode (follows the OS setting), screen-shake toggle, invertible vertical axis, full keyboard navigation, visible focus states, labelled controls, high-contrast support and auto-pause when the tab loses focus.
- **Adaptive audio** on the Web Audio API. Music is muffled in menus and opens up in flight. UI sounds are synthesised, and master, music and effects volumes are separate.
- **Three times of day:** sunrise, daylight and midnight.
- **Persistent settings and personal best**, saved on the device.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `W A S D` / arrow keys | Drag on the left half of the screen |
| Fire | `Space` (or `J`) | Hold **FIRE** |
| Boost | `Shift` (or `K`) | Hold **BOOST** |
| Pause | `Esc` / `P` | ⏸ button |
| Mute | `M` | 🔊 button |
| Launch / retry | `Enter` / `R` | Buttons |

## Tech

React 18 · Three.js · React Three Fiber · Drei · Vite · Web Audio API · GitHub Actions · Vercel

## Architecture

```
src/
├── App.jsx               screen flow, input, persistence
├── game/
│   ├── config.js         every tunable number (ships, sectors, scoring, fairness)
│   ├── state.js          mutable, non-reactive game state + object pools
│   ├── simulation.js     all gameplay rules in one frame-rate-independent step()
│   ├── audio.js          Web Audio engine (buffers, buses, synthesised UI sounds)
│   ├── events.js         tiny event bus: simulation → UI
│   └── storage.js        safe localStorage wrapper
├── scene/                rendering only, reads game state
│   ├── GameScene.jsx     Canvas, adaptive resolution, render order
│   ├── Ocean.jsx         GPU vertex-displaced waves with analytic normals
│   ├── Enemies.jsx       instanced asteroids + saucers (5 draw calls total)
│   ├── Projectiles.jsx   instanced lasers
│   ├── Particles.jsx     instanced explosions, sparks, splashes
│   ├── Clouds.jsx        instanced cloud clusters
│   ├── Environment.jsx   sky, fog, lights, stars, moon
│   └── Hero.jsx          player ship, banking, engine flame
├── ui/                   React UI, never re-rendered by gameplay
│   ├── HUD.jsx           writes to the DOM from its own rAF loop
│   ├── TouchControls.jsx floating stick + pointer-captured buttons
│   ├── MainMenu.jsx · Overlays.jsx · BootScreen.jsx · primitives.jsx · Icons.jsx
└── styles/global.css     design tokens + components
```

**Core idea:** React owns *screens*, the simulation owns *frames*. The 60 FPS loop writes to plain objects (`game`, `input`) that React never subscribes to. Renderers read from them, and the HUD reads from them in its own `requestAnimationFrame` loop, touching the DOM only when a value changes. Gameplay itself never triggers a React re-render.

## Run it locally

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
npm run playtest   # headless bot plays every ship and prints a balance table
```

## Deploy

The repo is set up for **Vercel**: import it, keep the detected *Vite* preset (build `npm run build`, output `dist`), and every push to `main` deploys. GitHub Actions builds every push as a check. Because `vite.config.js` uses a relative `base`, the same build also works on Netlify, GitHub Pages or any static host.

## Credits

- Ship models: *add source and licence here*
- Music and sound effects: *add source and licence here*
- Fonts: Chakra Petch and IBM Plex Mono (SIL Open Font License, via Google Fonts)

## Licence

MIT © 2026 Tejash Raj
