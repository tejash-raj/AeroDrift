// ─────────────────────────────────────────────────────────────
// Simulation — all gameplay rules in one deterministic step().
// Rendering components only *read* from `game`; this file is the
// only place that changes it during a frame.
// Everything is frame-rate independent (uses dt + exponential damping),
// so the game feels identical on 60 Hz and 120 Hz screens.
// ─────────────────────────────────────────────────────────────
import { Vector3 } from 'three';
import { RULES, SHIPS } from './config';
import { FX, game, input } from './state';
import { emit } from './events';
import { audio } from './audio';

const seg = new Vector3();
const toC = new Vector3();
const closest = new Vector3();
const look = new Vector3();
const aimPoint = new Vector3();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

let bulletCursor = 0;
let particleCursor = 0;

function sectorParams(sector) {
  const n = sector - 1;
  return {
    activeCount: Math.min(RULES.enemyPool, RULES.startEnemies + n * RULES.enemiesPerSector),
    speedMul: Math.min(RULES.maxSpeedMul, 1 + n * RULES.speedPerSector),
    ufoChance: Math.min(RULES.ufoChanceMax, RULES.ufoChanceStart + n * RULES.ufoChancePerSector),
  };
}

/** Score needed to reach `sector` (sector 1 = 0). Each sector costs a bit more than the last. */
export function scoreForSector(sector) {
  const n = sector - 1;
  return RULES.sectorScoreBase * n + (RULES.sectorScoreStep * n * (n - 1)) / 2;
}

function sectorFor(score, time) {
  let byScore = 1;
  while (score >= scoreForSector(byScore + 1)) byScore++;
  const byTime = 1 + Math.floor(time / RULES.sectorTimeFloor);
  return Math.max(byScore, byTime);
}

function addTrauma(amount) {
  if (!game.settings.screenShake || game.settings.reducedMotion) return;
  game.trauma = Math.min(1, game.trauma + amount);
}

// ── spawning ────────────────────────────────────────────────
export function spawnEnemy(e, aheadMin = RULES.spawnAheadMin, aheadMax = RULES.spawnAheadMax) {
  const { ufoChance } = sectorParams(game.sector);
  const h = game.hero.pos;
  const isUfo = Math.random() < ufoChance;

  e.type = isUfo ? 'ufo' : 'asteroid';
  e.scale = isUfo ? rand(0.9, 1.7) : rand(1.2, 3.2);
  // radius matches what you see: rock ≈ 3 units, saucer ≈ 3.8 units (before scale)
  e.radius = (isUfo ? 3.8 : 3) * e.scale;
  e.maxHp = isUfo ? 2 : e.scale > 2.6 ? 2 : 1; // UFOs and big rocks take two hits
  e.hp = e.maxHp;
  e.pos.set(
    h.x + rand(-0.5, 0.5) * RULES.spawnWidth,
    rand(RULES.enemyMinY, RULES.enemyMaxY),
    h.z - rand(aheadMin, aheadMax),
  );
  e.baseX = e.pos.x;
  e.seed = Math.random() * 100;
  e.rx = Math.random() * Math.PI;
  e.ry = Math.random() * Math.PI;
  e.spinX = rand(-1, 1) * 1.2;
  e.spinY = rand(-1, 1) * 1.6;
  e.drift = isUfo ? rand(10, 24) : rand(4, 16); // closing speed towards the player
  e.fall = isUfo ? 0 : rand(0, 2.4); // the "shower" — rocks sink towards the ocean
  e.flash = 0;
  e.fireTimer = rand(1.5, 3.5);
  e.charge = 0;
  e.alive = true;
  e.inPlay = true;
}

export function burst(pos, color, count, speed, size = 1, life = 0.9) {
  const pool = game.particles;
  for (let n = 0; n < count; n++) {
    const p = pool[particleCursor];
    particleCursor = (particleCursor + 1) % pool.length;
    p.active = true;
    p.pos.copy(pos);
    p.vel
      .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      .normalize()
      .multiplyScalar(speed * rand(0.35, 1));
    p.maxLife = life * rand(0.6, 1.2);
    p.life = p.maxLife;
    p.size = size * rand(0.6, 1.4);
    p.color = color;
  }
}

// ── lifecycle ───────────────────────────────────────────────
export function clearField() {
  for (const e of game.enemies) {
    e.inPlay = false;
    e.alive = false;
  }
  for (const b of game.bullets) b.active = false;
  for (const p of game.particles) p.active = false;
  for (const p of game.pickups) p.active = false;
  for (const b of game.bolts) b.active = false;
  const h = game.hero;
  h.pos.set(...RULES.heroStart);
  h.vel.set(0, 0);
  h.lean = 0;
  h.pitch = 0;
  h.dead = false;
  h.invuln = 0;
  h.boosting = false;
  game.trauma = 0;
  game.camBoost = 0;
  game.aim.visible = false;
  game.camBase.set(h.pos.x + 9, h.pos.y + 2.5, h.pos.z + 13); // snap — no swoop across the map
}

export function resetGame(shipKey) {
  const ship = SHIPS[shipKey] || SHIPS.defender;
  clearField();
  game.ship = ship;

  const h = game.hero;
  h.health = ship.maxHealth;
  h.ammo = ship.maxAmmo;
  h.ammoTrickle = 0;
  h.boost = 100;
  h.lastShot = -10;
  h.boostLocked = false;
  h.outOfAmmo = false;

  game.time = 0;
  game.score = 0;
  game.kills = 0;
  game.shots = 0;
  game.hits = 0;
  game.combo = 1;
  game.maxCombo = 1;
  game.comboTimer = 0;
  game.sector = 1;
  game.sectorStartedAt = 0;
  game.pickupTimer = rand(...RULES.pickupEvery);
  game.pickupsCollected = 0;
  game.boltsShot = 0;

  const p = sectorParams(1);
  game.activeCount = p.activeCount;
  game.speedMul = p.speedMul;
  game.enemies.forEach((e, i) => {
    if (i < game.activeCount) spawnEnemy(e, RULES.firstWaveAheadMin, RULES.spawnAheadMax);
  });
}

// ── combat ──────────────────────────────────────────────────
function segmentHitsSphere(a, b, center, r) {
  seg.subVectors(b, a);
  const len2 = seg.lengthSq();
  let t = len2 > 0 ? toC.subVectors(center, a).dot(seg) / len2 : 0;
  t = clamp(t, 0, 1);
  closest.copy(a).addScaledVector(seg, t);
  return closest.distanceToSquared(center) <= r * r;
}

function fire(h, ship) {
  const offsets = ship.twin && h.ammo >= 2 ? [-1.6, 1.6] : [0];
  h.ammo = Math.max(0, h.ammo - offsets.length);
  for (const ox of offsets) {
    const b = game.bullets[bulletCursor];
    bulletCursor = (bulletCursor + 1) % game.bullets.length;
    b.active = true;
    b.pos.set(h.pos.x + ox, h.pos.y - 0.2, h.pos.z - 4);
    b.prev.copy(b.pos);
    b.travelled = 0;
    game.shots++;
  }
  audio.play('laser', { volume: ship.twin ? 0.42 : 0.34, rate: rand(0.94, 1.06) * (ship.twin ? 0.82 : 1) });
}

function killEnemy(e, scored) {
  e.alive = false;
  const isUfo = e.type === 'ufo';
  burst(e.pos, isUfo ? FX.plasma : FX.ember, isUfo ? 26 : 20, 36 + e.scale * 8, 1 + e.scale * 0.35, 0.9);
  burst(e.pos, FX.spark, 8, 64, 0.7, 0.4);

  const dist = e.pos.distanceTo(game.hero.pos);
  audio.play('explosion', {
    volume: clamp(1.1 - dist / 900, 0.15, 0.9) * 0.75,
    rate: isUfo ? rand(1.1, 1.25) : rand(0.85, 1),
  });

  if (!scored) return;
  if (isUfo && Math.random() < RULES.ufoDropChance) spawnPickup(e.pos);
  game.kills++;
  if (game.comboTimer > 0) game.combo = Math.min(RULES.maxCombo, game.combo + 1);
  game.comboTimer = RULES.comboWindow;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  const points = Math.round(RULES.points[e.type] * game.combo * game.ship.scoreMul);
  game.score += points;
  addTrauma(0.12);
  emit('kill', { points, combo: game.combo, type: e.type });
}

function damageEnemy(e) {
  e.hp -= 1;
  e.flash = 0.12;
  if (e.hp > 0) {
    burst(e.pos, FX.spark, 6, 30, 0.6, 0.35);
    audio.synth('tick');
    emit('hit');
    return;
  }
  killEnemy(e, true);
}

function gameOver() {
  const h = game.hero;
  h.dead = true;
  h.boosting = false;
  game.phase = 'gameover';
  game.aim.visible = false;
  burst(h.pos, FX.ember, 44, 55, 1.8, 1.4);
  burst(h.pos, FX.spark, 22, 85, 1, 0.8);
  addTrauma(1);
  emit('gameover', {
    score: game.score,
    kills: game.kills,
    accuracy: game.shots ? game.hits / game.shots : 0,
    time: game.time,
    sector: game.sector,
    maxCombo: game.maxCombo,
    pickups: game.pickupsCollected,
    ship: game.ship.key,
  });
}

function damageHero(base) {
  const h = game.hero;
  const amount = Math.round(base * (1 + Math.max(0, game.sector - 8) * RULES.lateDamagePerSector));
  h.health = Math.max(0, h.health - amount);
  h.invuln = RULES.invulnTime;
  game.combo = 1;
  game.comboTimer = 0;
  addTrauma(0.75);
  audio.play('explosion', { volume: 1, rate: 0.72 });
  audio.synth('thud');
  try {
    navigator.vibrate?.(h.health <= 0 ? [90, 40, 180] : 70);
  } catch {
    /* vibration unsupported */
  }
  emit('damage', { amount, health: h.health });
  if (h.health <= 0) gameOver();
}

// ── per-phase updates ───────────────────────────────────────
function updateHero(dt) {
  const h = game.hero;
  const ship = game.ship;
  const k = input.keys;
  const t = input.touch;

  const g = input.tilt;
  let ax = clamp((k.right ? 1 : 0) - (k.left ? 1 : 0) + t.x + g.x, -1, 1);
  let ay = clamp((k.up ? 1 : 0) - (k.down ? 1 : 0) + t.y + g.y, -1, 1);
  if (game.settings.invertY) ay = -ay;
  const wantFire = k.fire || t.fire;
  const wantBoost = k.boost || t.boost;

  // boost — an emptied tank locks until it refills to RULES.boostRelock
  if (h.boostLocked && h.boost >= RULES.boostRelock) h.boostLocked = false;
  const wasBoosting = h.boosting;
  h.boosting = wantBoost && !h.boostLocked && h.boost > 0;
  if (h.boosting) {
    h.boost = Math.max(0, h.boost - ship.boostDrain * dt);
    if (h.boost === 0) {
      h.boostLocked = true;
      audio.synth('deny');
    }
  } else {
    h.boost = Math.min(100, h.boost + ship.boostRegen * dt);
  }
  if (h.boosting && !wasBoosting) audio.synth('whoosh');

  // ammo is limited — pickups refill it. Below a small reserve a slow
  // emergency trickle kicks in, so an empty gun is never a dead end.
  if (wantFire && game.time - h.lastShot >= ship.fireRate && h.ammo >= 1) {
    h.lastShot = game.time;
    fire(h, ship);
  }
  if (h.ammo < RULES.ammoReserveBelow) {
    h.ammoTrickle += RULES.ammoReserveRegen * dt;
    if (h.ammoTrickle >= 1) {
      h.ammoTrickle -= 1;
      h.ammo = Math.min(ship.maxAmmo, h.ammo + 1);
    }
  }
  const wasOut = h.outOfAmmo;
  h.outOfAmmo = wantFire && h.ammo < 1;
  if (h.outOfAmmo && !wasOut) audio.synth('deny');

  // movement
  h.vel.x = damp(h.vel.x, ax * ship.handling, 7, dt);
  h.vel.y = damp(h.vel.y, ay * ship.handling * 0.8, 7, dt);
  h.pos.x += h.vel.x * dt;
  h.pos.y = clamp(h.pos.y + h.vel.y * dt, RULES.heroMinY, RULES.heroMaxY);
  const forward = ship.speed * game.speedMul * (h.boosting ? RULES.boostMultiplier : 1);
  h.pos.z -= forward * dt;

  h.lean = damp(h.lean, -(h.vel.x / ship.handling) * 0.75, 9, dt);
  h.pitch = damp(h.pitch, (h.vel.y / ship.handling) * 0.35, 9, dt);
  h.invuln = Math.max(0, h.invuln - dt);
  return forward;
}

function updateEnemies(dt) {
  const h = game.hero;
  const pool = game.enemies;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (i >= game.activeCount) {
      e.inPlay = false;
      e.alive = false;
      continue;
    }
    if (!e.inPlay) spawnEnemy(e);

    // recycle once behind the camera or out of the flight corridor
    if (e.pos.z > h.pos.z + 40 || Math.abs(e.pos.x - h.pos.x) > RULES.spawnWidth * 0.8) {
      spawnEnemy(e);
      continue;
    }
    if (!e.alive) continue;

    e.flash = Math.max(0, e.flash - dt);
    if (e.type === 'asteroid') {
      e.rx += e.spinX * dt;
      e.ry += e.spinY * dt;
      e.pos.y -= e.fall * dt;
      e.pos.z += e.drift * dt;
      if (e.pos.y < RULES.oceanY + 14) {
        // rock hits the water: splash, no points
        e.alive = false;
        if (Math.abs(e.pos.z - h.pos.z) < 700) burst(e.pos, FX.foam, 14, 22, 1.2, 0.9);
        continue;
      }
    } else {
      e.pos.x = e.baseX + Math.sin(game.time * 1.3 + e.seed) * 22;
      e.pos.z += e.drift * dt;
      e.ry += 1.6 * dt;
      updateSaucerFire(e, dt);
    }

    if (h.invuln <= 0 && !h.dead) {
      const r = e.radius * RULES.rammingForgiveness + RULES.heroRadius;
      if (e.pos.distanceToSquared(h.pos) < r * r) {
        killEnemy(e, false);
        const d = RULES.damage;
        damageHero(Math.round(e.type === 'ufo' ? d.ufoRam : d.rockBase + e.scale * d.rockPerScale));
        if (h.dead) return;
      }
    }
  }
}

// ── saucer fire ─────────────────────────────────────────────
let boltCursor = 0;

function updateSaucerFire(e, dt) {
  if (game.sector < RULES.enemyFireSector || game.hero.dead) return;
  const h = game.hero.pos;
  const ahead = h.z - e.pos.z;
  const inRange = ahead > RULES.fireRange[0] && ahead < RULES.fireRange[1] && Math.abs(e.pos.x - h.x) < 120;

  if (e.charge > 0) {
    e.charge -= dt;
    if (e.charge <= 0) fireBolt(e);
    return;
  }
  if (!inRange) return;
  e.fireTimer -= dt;
  if (e.fireTimer <= 0) {
    // telegraph first: the dome glows amber, then the shot comes
    e.charge = RULES.fireTelegraph;
    const interval = Math.max(
      RULES.fireIntervalMin,
      RULES.fireIntervalStart - (game.sector - RULES.enemyFireSector) * RULES.fireIntervalStep,
    );
    e.fireTimer = rand(interval * 0.7, interval * 1.3);
    if (ahead < 450) audio.synth('charge');
  }
}

function fireBolt(e) {
  const b = game.bolts[boltCursor];
  boltCursor = (boltCursor + 1) % game.bolts.length;
  b.active = true;
  b.pos.copy(e.pos);
  b.prev.copy(e.pos);
  // aimed where you are now, not where you'll be — moving dodges it
  const speed = Math.min(
    RULES.boltSpeedMax,
    RULES.boltSpeed + (game.sector - RULES.enemyFireSector) * RULES.boltSpeedPerSector,
  );
  b.vel.subVectors(game.hero.pos, e.pos).normalize().multiplyScalar(speed);
  b.life = RULES.boltLife;
}

function updateBolts(dt) {
  const h = game.hero;
  for (const b of game.bolts) {
    if (!b.active) continue;
    b.prev.copy(b.pos);
    b.pos.addScaledVector(b.vel, dt);
    b.life -= dt;
    if (b.life <= 0 || b.pos.z > h.pos.z + 30) {
      b.active = false;
      continue;
    }
    if (h.invuln <= 0 && !h.dead) {
      const r = RULES.boltRadius + RULES.heroRadius * RULES.rammingForgiveness;
      if (segmentHitsSphere(b.prev, b.pos, h.pos, r)) {
        b.active = false;
        burst(b.pos, FX.bolt, 10, 30, 0.8, 0.4);
        damageHero(RULES.damage.bolt);
        if (h.dead) return;
      }
    }
  }
}

// ── pickups ─────────────────────────────────────────────────
let pickupCursor = 0;

function neededPickup() {
  const h = game.hero;
  const needHealth = 1 - h.health / game.ship.maxHealth;
  const needAmmo = 1 - h.ammo / game.ship.maxAmmo;
  // bias towards what you're short of, but never fully predictable
  return Math.random() < (needHealth + 0.15) / (needHealth + needAmmo + 0.3) ? 'health' : 'ammo';
}

export function spawnPickup(at) {
  const p = game.pickups[pickupCursor];
  pickupCursor = (pickupCursor + 1) % game.pickups.length;
  const h = game.hero.pos;
  p.active = true;
  p.type = neededPickup();
  p.seed = Math.random() * 10;
  if (at) p.pos.copy(at);
  else
    p.pos.set(
      h.x + rand(-1, 1) * RULES.pickupSpread,
      rand(RULES.heroMinY + 6, 60),
      h.z - rand(...RULES.pickupAhead),
    );
}

function updatePickups(dt) {
  const h = game.hero;
  game.pickupTimer -= dt;
  if (game.pickupTimer <= 0) {
    spawnPickup();
    game.pickupTimer = rand(...RULES.pickupEvery) * (1 + (game.sector - 1) * RULES.pickupSlowdown);
  }
  for (const p of game.pickups) {
    if (!p.active) continue;
    if (p.pos.z > h.pos.z + 30) {
      p.active = false;
      continue;
    }
    const d = p.pos.distanceTo(h.pos);
    if (d < RULES.pickupMagnet) {
      // gentle magnet: near misses still count
      seg.subVectors(h.pos, p.pos).normalize();
      p.pos.addScaledVector(seg, Math.min(d, 70 * dt));
    }
    if (d < RULES.pickupRadius + RULES.heroRadius) {
      p.active = false;
      const ship = game.ship;
      const value = RULES.pickupValue[p.type];
      if (p.type === 'health') h.health = Math.min(ship.maxHealth, h.health + value);
      else h.ammo = Math.min(ship.maxAmmo, h.ammo + value);
      game.pickupsCollected++;
      burst(p.pos, p.type === 'health' ? FX.heal : FX.ammo, 16, 26, 0.8, 0.6);
      audio.synth('pickup');
      emit('pickup', { type: p.type, amount: value });
    }
  }
}

function updateBullets(dt, forward) {
  for (const b of game.bullets) {
    if (!b.active) continue;
    b.prev.copy(b.pos);
    const d = (RULES.bulletSpeed + forward) * dt;
    b.pos.z -= d;
    b.travelled += d;
    if (b.travelled > RULES.bulletRange) {
      b.active = false;
      continue;
    }
    // lasers can shoot incoming bolts down
    let hitBolt = false;
    for (const bolt of game.bolts) {
      if (!bolt.active) continue;
      if (segmentHitsSphere(b.prev, b.pos, bolt.pos, RULES.boltRadius + 1.2)) {
        bolt.active = false;
        b.active = false;
        hitBolt = true;
        game.boltsShot++;
        game.score += RULES.boltPoints;
        burst(bolt.pos, FX.spark, 8, 40, 0.6, 0.35);
        audio.synth('tick');
        emit('kill', { points: RULES.boltPoints, combo: 1, type: 'bolt' });
        break;
      }
    }
    if (hitBolt) continue;

    // swept test: the bullet is a segment prev→pos, so it can never tunnel
    for (let i = 0; i < game.activeCount; i++) {
      const e = game.enemies[i];
      if (!e.alive) continue;
      const r = e.radius * RULES.shotGenerosity + 0.6;
      if (e.pos.z - r > b.prev.z || e.pos.z + r < b.pos.z) continue;
      if (segmentHitsSphere(b.prev, b.pos, e.pos, r)) {
        b.active = false;
        game.hits++;
        damageEnemy(e);
        break;
      }
    }
  }
}

function updateParticles(dt) {
  const drag = Math.exp(-2.2 * dt);
  for (const p of game.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.vel.multiplyScalar(drag);
    p.pos.addScaledVector(p.vel, dt);
  }
}

function updatePlaying(dt) {
  game.time += dt;

  const target = sectorFor(game.score, game.time);
  if (target > game.sector && game.time - game.sectorStartedAt >= RULES.sectorMinGap) {
    const sector = game.sector + 1; // one step at a time
    game.sector = sector;
    game.sectorStartedAt = game.time;
    const p = sectorParams(sector);
    game.activeCount = p.activeCount;
    game.speedMul = p.speedMul;
    audio.synth('chime');
    emit('sector', sector);
  }

  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) game.combo = 1;
  }

  const forward = updateHero(dt);
  updateEnemies(dt);
  if (game.phase !== 'playing') return; // died this frame
  updateBolts(dt);
  if (game.phase !== 'playing') return;
  updatePickups(dt);
  updateBullets(dt, forward);
}

// ── camera ──────────────────────────────────────────────────
function applyCamera(camera, dt, targetFov) {
  const shake = game.trauma * game.trauma;
  camera.position.copy(game.camBase);
  if (shake > 0.0001) {
    const t = game.ambientTime * 32;
    camera.position.x += (Math.sin(t * 1.7) * Math.cos(t * 0.9)) * shake * 2.4;
    camera.position.y += (Math.sin(t * 1.3 + 2) * Math.cos(t * 1.1)) * shake * 2.0;
  }
  game.trauma = Math.max(0, game.trauma - dt * 1.4);
  const fov = damp(camera.fov, targetFov, 5, dt);
  if (Math.abs(fov - camera.fov) > 0.001) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function cameraPlaying(camera, dt) {
  const h = game.hero;
  game.camBoost = damp(game.camBoost, h.boosting ? 1 : 0, 4, dt);
  const b = game.camBase;
  const k = 1 - Math.exp(-6 * dt);
  b.x += (h.pos.x - b.x) * k;
  b.y += (h.pos.y + 4.5 - b.y) * k;
  b.z = h.pos.z + 15 + game.camBoost * 7; // locked on z: no speed-dependent lag
  const fovBoost = game.settings.reducedMotion ? 6 : 17;
  applyCamera(camera, dt, 65 + game.camBoost * fovBoost);
  look.set(h.pos.x, h.pos.y + 1.5, h.pos.z - 25);
  camera.lookAt(look);
  if (!game.settings.reducedMotion) camera.rotateZ(h.lean * 0.08);
}

function cameraMenu(camera, dt, size) {
  const h = game.hero.pos;
  const t = game.ambientTime;
  const sway = game.settings.reducedMotion ? 0 : 1;
  const portrait = size.width < size.height;
  const target = look.set(
    h.x + (portrait ? 0 : 9) + Math.sin(t * 0.25) * 1.5 * sway,
    h.y + 2.5 + Math.sin(t * 0.4) * 0.6 * sway,
    h.z + (portrait ? 17 : 13),
  );
  game.camBase.lerp(target, 1 - Math.exp(-3 * dt));
  applyCamera(camera, dt, portrait ? 62 : 52);
  if (portrait) camera.lookAt(h.x, h.y - 3.2, h.z);
  else camera.lookAt(h.x - 6.5, h.y + 0.6, h.z - 2);
}

function cameraGameOver(camera, dt) {
  const h = game.hero.pos;
  game.camBase.lerp(look.set(h.x, h.y + 14, h.z + 36), 1 - Math.exp(-1.1 * dt));
  applyCamera(camera, dt, 60);
  camera.lookAt(h);
}

function updateAim(camera) {
  if (game.phase !== 'playing') return;
  const h = game.hero.pos;
  camera.updateMatrixWorld();
  aimPoint.set(h.x, h.y - 0.2, h.z - 220).project(camera);
  game.aim.x = (aimPoint.x + 1) / 2;
  game.aim.y = (1 - aimPoint.y) / 2;
  game.aim.visible = true;
}

/** Advance the world by `delta` seconds. Called once per rendered frame. */
export function step(delta, camera, size) {
  if (game.phase === 'paused') return;
  const dt = Math.min(delta, 1 / 20); // a hitch or tab-switch can never teleport you
  game.ambientTime += dt;
  updateParticles(dt);

  if (game.phase === 'playing') {
    updatePlaying(dt);
    if (game.phase === 'playing') cameraPlaying(camera, dt);
    else cameraGameOver(camera, dt);
  } else if (game.phase === 'gameover') {
    cameraGameOver(camera, dt);
  } else {
    cameraMenu(camera, dt, size);
  }
  updateAim(camera);
}
