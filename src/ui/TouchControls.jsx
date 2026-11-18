import { useEffect, useRef } from 'react';
import { input } from '../game/state';
import { recenterTilt } from '../game/tilt';
import { audio } from '../game/audio';

const RADIUS = 56;
const DEADZONE = 0.12;

const shape = (v) => {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  return Math.sign(v) * Math.min(1, (a - DEADZONE) / (1 - DEADZONE));
};

/**
 * Hold-to-act button. Pointer capture guarantees we always receive the
 * release — a thumb sliding off the button can no longer leave the
 * ship firing or boosting forever.
 */
function HoldButton({ action, label, className, children }) {
  const set = (el, v) => {
    input.touch[action] = v;
    el.classList.toggle('is-pressed', v);
  };
  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e.currentTarget, true);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* unsupported */
        }
      }}
      onPointerUp={(e) => set(e.currentTarget, false)}
      onPointerCancel={(e) => set(e.currentTarget, false)}
      onLostPointerCapture={(e) => set(e.currentTarget, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/**
 * Floating analog stick: touch anywhere in the left half and the stick
 * appears under your thumb. Supports diagonals and partial deflection.
 */
export default function TouchControls({ showHints, tilt }) {
  const zone = useRef(null);
  const base = useRef(null);
  const knob = useRef(null);
  const pointer = useRef(null);
  const origin = useRef({ x: 0, y: 0 });

  const placeBase = (x, y) => {
    base.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  // resting spot: bottom-left, inside the thumb's natural arc
  const restBase = () => {
    if (!zone.current || pointer.current !== null) return;
    const h = zone.current.getBoundingClientRect().height;
    placeBase(Math.max(84, window.innerWidth * 0.12), h - 96);
  };

  useEffect(() => {
    restBase();
    window.addEventListener('resize', restBase);
    return () => {
      window.removeEventListener('resize', restBase);
      input.touch.x = 0;
      input.touch.y = 0;
      input.touch.fire = false;
      input.touch.boost = false;
    };
  }, []);
  const placeKnob = (dx, dy) => {
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const release = (e) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    input.touch.x = 0;
    input.touch.y = 0;
    placeKnob(0, 0);
    zone.current.classList.remove('is-active');
    restBase();
  };

  const move = (e) => {
    if (e.pointerId !== pointer.current) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    placeKnob(dx, dy);
    input.touch.x = shape(dx / RADIUS);
    input.touch.y = shape(-dy / RADIUS);
  };

  const down = (e) => {
    if (pointer.current !== null) return;
    e.preventDefault();
    pointer.current = e.pointerId;
    zone.current.setPointerCapture(e.pointerId);
    const rect = zone.current.getBoundingClientRect();
    origin.current = { x: e.clientX, y: e.clientY };
    placeBase(e.clientX - rect.left, e.clientY - rect.top);
    zone.current.classList.add('is-active');
    move(e);
  };

  return (
    <div className="touch">
      {tilt && (
        <div className="tilt-chip">
          <span>Tilt to steer</span>
          <button
            type="button"
            className="tilt-chip__btn"
            onClick={() => {
              recenterTilt();
              audio.synth('click');
            }}
          >
            Recenter
          </button>
        </div>
      )}
      <div
        hidden={tilt}
        ref={zone}
        className="touch__stick-zone"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        aria-hidden="true"
      >
        <div ref={base} className="stick">
          <div ref={knob} className="stick__knob" />
        </div>
        {showHints && !tilt && <span className="touch__hint touch__hint--stick">Drag to steer</span>}
      </div>

      <div className="touch__buttons">
        <HoldButton action="boost" label="Boost" className="touch-btn--boost">
          Boost
        </HoldButton>
        <HoldButton action="fire" label="Fire" className="touch-btn--fire">
          Fire
        </HoldButton>
        {showHints && <span className="touch__hint touch__hint--buttons">Hold to fire · hold to boost</span>}
      </div>
    </div>
  );
}
