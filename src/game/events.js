// Tiny event bus: the simulation announces moments (kill, damage,
// sector, gameover) and the UI reacts — without React re-rendering
// anything inside the 60 FPS loop.
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => fn(payload));
}
