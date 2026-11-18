import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { ShipGlyph } from './Icons';

/**
 * Boot screen doubles as the loading screen: it waits for the 3D assets
 * (with a short minimum so the intro reads), then continues on its own.
 * Any key / tap skips it once loading is done.
 */
export default function BootScreen({ onDone, reducedMotion, touch }) {
  const { progress, active } = useProgress();
  const [minElapsed, setMinElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const loaded = !active && (progress === 100 || progress === 0);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), reducedMotion ? 500 : 2200);
    const failSafe = setTimeout(() => setMinElapsed('force'), 9000); // never trap the player
    return () => {
      clearTimeout(t);
      clearTimeout(failSafe);
    };
  }, [reducedMotion]);

  const ready = loaded || minElapsed === 'force';

  useEffect(() => {
    if (ready && minElapsed) setLeaving(true);
  }, [ready, minElapsed]);

  // separate effect so setting `leaving` can't cancel its own exit timer
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => done.current(), reducedMotion ? 0 : 450);
    return () => clearTimeout(t);
  }, [leaving, reducedMotion]);

  useEffect(() => {
    if (!ready) return;
    const skip = () => setMinElapsed(true);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [ready]);

  const pct = Math.round(active ? progress : 100);

  return (
    <div className={`boot ${leaving ? 'boot--leaving' : ''}`} role="status" aria-live="polite">
      <div className="boot__inner">
        <ShipGlyph size={44} className="boot__glyph" />
        <h1 className="boot__title">
          AERO<span>DRIFT</span>
        </h1>
        <p className="boot__credit">made by Tejash Raj</p>
        <div className="boot__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="boot__hint">
          {ready ? (touch ? 'Tap to continue' : 'Press any key') : `Loading flight systems · ${pct}%`}
        </p>
      </div>
    </div>
  );
}
