// ─────────────────────────────────────────────────────────────
// Headless playtest bot:  npm run playtest
//
// Runs the real game simulation (no rendering) with a simple bot pilot,
// several runs per ship, and prints a balance table. Used to tune
// RULES / SHIPS in src/game/config.js before human playtesting.
// The bot can't aim, so read the numbers as *relative*, not absolute.
// ─────────────────────────────────────────────────────────────
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'node_modules/.cache/aerodrift-playtest.mjs');
const RUNS = Number(process.env.RUNS || 5);

const entry = `
import { resetGame, step } from './src/game/simulation.js';
import { game, input, clearInput } from './src/game/state.js';
import { SHIPS } from './src/game/config.js';
import { Vector3 } from 'three';

const camera = { position: new Vector3(), fov: 52, updateProjectionMatrix() {}, lookAt() {}, rotateZ() {}, updateMatrixWorld() {} };
const size = { width: 1280, height: 720 };
const dt = 1 / 60;
const rows = [];

for (const key of Object.keys(SHIPS)) {
  const acc = { time: 0, score: 0, kills: 0, sector: 0, accuracy: 0 };
  for (let r = 0; r < ${RUNS}; r++) {
    resetGame(key);
    game.phase = 'playing';
    clearInput();
    let t = 0;
    while (game.phase === 'playing' && t < 900) {
      input.keys.fire = true;
      input.keys.left = Math.sin(t * 0.7 + r) < -0.3;
      input.keys.right = Math.sin(t * 0.7 + r) > 0.3;
      input.keys.up = Math.sin(t * 0.45) > 0.5;
      input.keys.down = Math.sin(t * 0.45) < -0.5;
      input.keys.boost = t % 9 < 1.5;
      step(dt, camera, size);
      t += dt;
    }
    acc.time += t; acc.score += game.score; acc.kills += game.kills; acc.sector += game.sector;
    acc.accuracy += game.shots ? game.hits / game.shots : 0;
  }
  rows.push({
    ship: SHIPS[key].name,
    'avg survival (s)': +(acc.time / ${RUNS}).toFixed(1),
    'avg score': Math.round(acc.score / ${RUNS}),
    'avg kills': +(acc.kills / ${RUNS}).toFixed(1),
    'avg sector': +(acc.sector / ${RUNS}).toFixed(1),
    'accuracy %': Math.round((acc.accuracy / ${RUNS}) * 100),
  });
}
console.log('\\nAeroDrift playtest bot — ${RUNS} runs per ship\\n');
console.table(rows);
`;

mkdirSync(dirname(out), { recursive: true });
await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'playtest-entry.js' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
  define: { 'import.meta.env': '{"BASE_URL":"./"}' },
  alias: process.env.PLAYTEST_THREE ? { three: process.env.PLAYTEST_THREE } : undefined,
});
await import(pathToFileURL(out).href);
