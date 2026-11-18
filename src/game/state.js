// ─────────────────────────────────────────────────────────────
// Mutable, non-reactive game state.
// Read and written every frame by the simulation and the renderers.
// React never subscribes to this object — that is the point.
// ─────────────────────────────────────────────────────────────
import { Color, Vector2, Vector3 } from 'three';
import { RULES, SHIPS } from './config';

export const input = {
  keys: { left: false, right: false, up: false, down: false, fire: false, boost: false },
  touch: { x: 0, y: 0, fire: false, boost: false }, // x / y are analog, -1..1
};

export function clearInput() {
  for (const k of Object.keys(input.keys)) input.keys[k] = false;
  input.touch.x = 0;
  input.touch.y = 0;
  input.touch.fire = false;
  input.touch.boost = false;
}

// Shared colours for particles (pre-built so nothing is parsed per frame)
export const FX = {
  ember: new Color('#ff8a3d'),
  plasma: new Color('#5ee1ff'),
  spark: new Color('#fff1d6'),
  foam: new Color('#e6f4ff'),
};

const makeEnemy = () => ({
  type: 'asteroid',
  inPlay: false,
  alive: false,
  hp: 1,
  maxHp: 1,
  scale: 1,
  radius: 3,
  pos: new Vector3(),
  baseX: 0,
  seed: 0,
  rx: 0,
  ry: 0,
  spinX: 0,
  spinY: 0,
  drift: 0,
  fall: 0,
  flash: 0,
});

const makeBullet = () => ({ active: false, pos: new Vector3(), prev: new Vector3(), travelled: 0 });

const makeParticle = () => ({
  active: false,
  pos: new Vector3(),
  vel: new Vector3(),
  life: 0,
  maxLife: 1,
  size: 1,
  color: FX.spark,
});

export const game = {
  phase: 'menu', // menu | playing | paused | gameover
  time: 0, // run time — only advances while playing
  ambientTime: 0, // world time — advances everywhere except pause

  ship: SHIPS.defender,
  hero: {
    pos: new Vector3(...RULES.heroStart),
    vel: new Vector2(),
    lean: 0,
    pitch: 0,
    hull: SHIPS.defender.hull,
    boost: 100,
    energy: 100,
    lastShot: -10,
    boosting: false,
    boostLocked: false,
    recharging: false,
    invuln: 0,
    dead: false,
  },

  enemies: Array.from({ length: RULES.enemyPool }, makeEnemy),
  bullets: Array.from({ length: RULES.bulletPool }, makeBullet),
  particles: Array.from({ length: RULES.particlePool }, makeParticle),

  score: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  combo: 1,
  maxCombo: 1,
  comboTimer: 0,
  sector: 1,
  activeCount: RULES.startEnemies,
  speedMul: 1,

  trauma: 0, // 0..1, screen shake = trauma²
  camBase: new Vector3(9, 20.5, 13),
  camBoost: 0,
  aim: { x: 0.5, y: 0.5, visible: false }, // crosshair in normalised screen space

  settings: { screenShake: true, reducedMotion: false, invertY: false },
};
