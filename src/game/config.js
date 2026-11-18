// ─────────────────────────────────────────────────────────────
// AeroDrift — game design data
// Every tunable number lives here so balancing never means
// digging through rendering code.
// ─────────────────────────────────────────────────────────────

export const SHIPS = {
  interceptor: {
    key: 'interceptor',
    name: 'Interceptor',
    role: 'Glass cannon',
    description: 'Fastest hull and the quickest trigger. Three hits and you are out.',
    model: 'rocket_topA.glb',
    color: '#ff5a6e',
    laser: '#ffc2ca',
    speed: 92, // forward units / second
    handling: 68, // lateral units / second at full stick
    hull: 3,
    fireRate: 0.1, // seconds between shots
    energyCost: 9,
    energyRegen: 58, // energy / second once you stop firing
    boostDrain: 40,
    boostRegen: 16,
    twin: false,
    scoreMul: 1.5, // risk / reward: fragile ships earn more
    stats: { speed: 5, handling: 5, hull: 2 },
  },
  defender: {
    key: 'defender',
    name: 'Defender',
    role: 'All-rounder',
    description: 'Balanced speed, handling and armour. The best ship to learn on.',
    model: 'rocket_baseA.glb',
    color: '#ffb547',
    laser: '#ffe2ad',
    speed: 72,
    handling: 58,
    hull: 5,
    fireRate: 0.14,
    energyCost: 12,
    energyRegen: 50,
    boostDrain: 30,
    boostRegen: 14,
    twin: false,
    scoreMul: 1.2,
    stats: { speed: 3, handling: 4, hull: 3 },
  },
  juggernaut: {
    key: 'juggernaut',
    name: 'Juggernaut',
    role: 'Heavy armour',
    description: 'Slow to turn, built to absorb punishment. Fires twin cannons.',
    model: 'rocket_baseB.glb',
    color: '#5ee1ff',
    laser: '#c4f5ff',
    speed: 56,
    handling: 46,
    hull: 6,
    fireRate: 0.22,
    energyCost: 20,
    energyRegen: 52,
    boostDrain: 22,
    boostRegen: 12,
    twin: true,
    scoreMul: 1,
    stats: { speed: 2, handling: 2, hull: 5 },
  },
};

export const SHIP_ORDER = ['interceptor', 'defender', 'juggernaut'];

export const TIMES = {
  morning: {
    key: 'morning',
    label: 'Sunrise',
    sun: [100, 4, -100],
    rayleigh: 3,
    turbidity: 8,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.86,
    ambient: 0.5,
    hemi: 0.45,
    skyTint: '#ffd2b0',
    sunIntensity: 1.2,
    sunColor: '#ffcf9e',
    water: '#244a86',
    waterGlow: 0.06,
    fog: '#d39f8c',
    fogNear: 220,
    fogFar: 880,
    cloud: '#ffd9c7',
    night: false,
  },
  day: {
    key: 'day',
    label: 'Daylight',
    sun: [50, 50, -100],
    rayleigh: 0.5,
    turbidity: 0.6,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    ambient: 0.7,
    hemi: 0.55,
    skyTint: '#cfe6ff',
    sunIntensity: 1.35,
    sunColor: '#ffffff',
    water: '#0b6cae',
    waterGlow: 0.05,
    fog: '#b9d3ea',
    fogNear: 240,
    fogFar: 900,
    cloud: '#ffffff',
    night: false,
  },
  night: {
    key: 'night',
    label: 'Midnight',
    sun: [0, -10, -100],
    rayleigh: 0.1,
    turbidity: 20,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    ambient: 0.32,
    hemi: 0.35,
    skyTint: '#3a5888',
    sunIntensity: 0.25,
    sunColor: '#bcd6ff',
    water: '#164878',
    waterGlow: 0.16,
    fog: '#0a1322',
    fogNear: 200,
    fogFar: 820,
    cloud: '#4a5a7c',
    night: true,
  },
};

export const TIME_ORDER = ['morning', 'day', 'night'];

export const RULES = {
  // pools (fixed-size, recycled — no allocation during play)
  enemyPool: 90,
  bulletPool: 40,
  particlePool: 280,

  // difficulty ramps every sector
  sectorDuration: 30, // seconds
  startEnemies: 26,
  enemiesPerSector: 9,
  speedPerSector: 0.07,
  maxSpeedMul: 1.6,
  ufoChanceStart: 0.28,
  ufoChancePerSector: 0.05,
  ufoChanceMax: 0.6,

  // spawning volume, relative to the player
  spawnAheadMin: 450,
  spawnAheadMax: 1500,
  firstWaveAheadMin: 280, // first enemies arrive ~4s after launch
  spawnWidth: 320,
  enemyMinY: 10,
  enemyMaxY: 70,

  // player
  heroStart: [0, 18, 0],
  heroMinY: 6,
  heroMaxY: 75,
  heroRadius: 2.2,
  invulnTime: 1.4, // seconds of mercy after a hit
  boostMultiplier: 1.8,
  boostRelock: 25, // an emptied boost tank unlocks again at this level

  // fairness: collisions forgive, shots are generous
  rammingForgiveness: 0.8, // enemy radius multiplier when it hits you
  shotGenerosity: 1.15, // enemy radius multiplier when you hit it
  bulletSpeed: 950,
  bulletRange: 1300,

  // scoring
  points: { asteroid: 100, ufo: 250 },
  comboWindow: 2.6, // seconds to chain the next kill
  maxCombo: 5,

  oceanY: -25,
};

const mm = (q) => typeof window !== 'undefined' && window.matchMedia && window.matchMedia(q).matches;

export const prefersReducedMotion = mm('(prefers-reduced-motion: reduce)');
export const isCoarsePointer = mm('(pointer: coarse)');

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  muted: false,
  quality: isCoarsePointer ? 'low' : 'high',
  screenShake: !prefersReducedMotion,
  reducedMotion: prefersReducedMotion,
  controlMode: 'auto', // auto | keyboard | touch
  invertY: false,
  showHints: true,
};

export const PORTFOLIO_URL = 'https://www.behance.net/tejashraj';
