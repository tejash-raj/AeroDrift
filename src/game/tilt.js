// ─────────────────────────────────────────────────────────────
// Tilt-to-steer (gyroscope / DeviceOrientation API).
//
// We turn the device's beta/gamma angles into a gravity vector,
// rotate it into *screen* space using the current screen orientation,
// and compare it with a neutral pose captured at launch. That makes
// steering work the same in portrait and in either landscape grip,
// and lets the player hold the phone at whatever angle is comfortable.
//
//  • iOS needs permission, requested from a tap (user gesture).
//  • Needs HTTPS (Vercel provides it).
// ─────────────────────────────────────────────────────────────
import { input } from './state';

const DEG = Math.PI / 180;
const DEADZONE = 0.04; // ≈ 2.3° of tilt does nothing

const state = {
  listening: false,
  hasData: false,
  enabled: false,
  sensitivity: 0.5, // 0..1 → full deflection at 30°..10° of tilt
  raw: { beta: 0, gamma: 0 },
  neutral: { x: 0, y: 0 },
  pendingRecenter: true, // first reading after launch becomes neutral
};

export const tiltSupported =
  typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && 'ontouchstart' in window;

function screenAngle() {
  const a = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}

/** Gravity in screen space: x → right edge down, y → top edge down. Pure, exported for tests. */
export function screenGravity(beta, gamma, angleDeg) {
  const b = beta * DEG;
  const g = gamma * DEG;
  // gravity (pointing down) in device coordinates
  const dx = Math.sin(g) * Math.cos(b);
  const dy = -Math.sin(b);
  // rotate into screen coordinates (device rotated counter-clockwise by angle)
  const t = angleDeg * DEG;
  return {
    x: dx * Math.cos(t) - dy * Math.sin(t),
    y: dx * Math.sin(t) + dy * Math.cos(t),
  };
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  state.raw.beta = e.beta;
  state.raw.gamma = e.gamma;
  state.hasData = true;
  if (!state.enabled) return;
  const g = screenGravity(e.beta, e.gamma, screenAngle());
  if (state.pendingRecenter) {
    state.neutral.x = g.x;
    state.neutral.y = g.y;
    state.pendingRecenter = false;
  }
  const full = Math.sin((30 - state.sensitivity * 20) * DEG); // gravity change for full deflection
  const shape = (v) => {
    const a = Math.abs(v);
    if (a < DEADZONE) return 0;
    return Math.sign(v) * Math.min(1, (a - DEADZONE) / (full - DEADZONE));
  };
  input.tilt.x = shape(g.x - state.neutral.x);
  input.tilt.y = shape(state.neutral.y - g.y); // tilt the top towards you to climb
}

function listen() {
  if (state.listening || !tiltSupported) return;
  window.addEventListener('deviceorientation', onOrientation);
  state.listening = true;
}

/** Must be called from a tap/click. Resolves true when tilt data is allowed. */
export async function requestTilt() {
  if (!tiltSupported) return false;
  try {
    const DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      const result = await DOE.requestPermission();
      if (result !== 'granted') return false;
    }
    listen();
    return true;
  } catch {
    return false;
  }
}

/** Current pose becomes "straight and level". */
export function recenterTilt() {
  if (!state.hasData) {
    state.pendingRecenter = true;
    return;
  }
  const g = screenGravity(state.raw.beta, state.raw.gamma, screenAngle());
  state.neutral.x = g.x;
  state.neutral.y = g.y;
  input.tilt.x = 0;
  input.tilt.y = 0;
}

export function setTilt({ enabled, sensitivity }) {
  state.enabled = !!enabled && tiltSupported;
  if (sensitivity != null) state.sensitivity = sensitivity;
  if (state.enabled) listen();
  else {
    input.tilt.x = 0;
    input.tilt.y = 0;
  }
}

export const tiltHasData = () => state.hasData;
