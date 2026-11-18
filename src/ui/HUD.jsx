import { useEffect, useRef, useState } from 'react';
import { RULES } from '../game/config';
import { game } from '../game/state';
import { on } from '../game/events';
import { MuteIcon, PauseIcon, SoundIcon } from './Icons';
import { Kbd } from './primitives';

// Restart a CSS animation on an element (remove class → reflow → add).
function pulse(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * The HUD reads the mutable game state in its own rAF loop and writes
 * straight to the DOM — only when a value actually changes. React renders
 * it once per run; gameplay never triggers a React re-render.
 */
export default function HUD({ best, touch, showHints, muted, onPause, onToggleMute }) {
  const ship = game.ship;
  const r = useRef({}).current; // element registry, filled by callback refs
  const [toast, setToast] = useState(null);
  const [pop, setPop] = useState(null);
  const [hints, setHints] = useState(showHints);

  useEffect(() => {
    if (!showHints) return;
    const t = setTimeout(() => setHints(false), 9000);
    return () => clearTimeout(t);
  }, [showHints]);

  useEffect(() => {
    let raf;
    const last = {};
    const set = (key, value, fn) => {
      if (last[key] === value) return;
      last[key] = value;
      fn(value);
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!r.score || !r.crosshair) return; // between unmount and cleanup
      const h = game.hero;
      set('score', game.score, (v) => (r.score.textContent = v.toLocaleString()));
      set('best', Math.max(best, game.score), (v) => (r.best.textContent = v.toLocaleString()));
      set('sector', game.sector, (v) => (r.sector.textContent = String(v).padStart(2, '0')));

      const comboOn = game.combo > 1;
      set('comboOn', comboOn, (v) => r.combo.classList.toggle('is-on', v));
      set('combo', game.combo, (v) => {
        r.comboValue.textContent = `×${v}`;
        if (v > 1) pulse(r.combo, 'is-bump');
      });
      r.combo.style.setProperty('--t', Math.max(0, game.comboTimer / RULES.comboWindow).toFixed(3));

      set('hull', h.hull, (v) => {
        [...r.hull.children].forEach((pip, i) => pip.classList.toggle('is-empty', i >= v));
        r.danger.classList.toggle('is-on', v === 1);
      });

      set('boost', Math.round(h.boost), (v) => (r.boostBar.style.transform = `scaleX(${v / 100})`));
      set('boostLocked', h.boostLocked, (v) => r.boost.classList.toggle('is-locked', v));
      set('boosting', h.boosting, (v) => r.boost.classList.toggle('is-active', v));

      set('energy', Math.round(h.energy), (v) => (r.energyBar.style.transform = `scaleX(${v / 100})`));
      set('recharging', h.recharging, (v) => {
        r.energy.classList.toggle('is-low', v);
        r.energyState.textContent = v ? 'Recharging' : '';
      });

      const ax = Math.round(game.aim.x * window.innerWidth);
      const ay = Math.round(game.aim.y * window.innerHeight);
      set('aim', `${ax},${ay},${game.aim.visible}`, () => {
        r.crosshair.style.transform = `translate(${ax}px, ${ay}px)`;
        r.crosshair.style.opacity = game.aim.visible ? '' : '0';
      });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [best, r]);

  useEffect(() => {
    const offs = [
      on('damage', () => pulse(r.damage, 'is-flash')),
      on('hit', () => pulse(r.crosshair, 'is-hit')),
      on('kill', ({ points, combo }) => {
        pulse(r.crosshair, 'is-kill');
        setPop({ id: Math.random(), points, combo });
      }),
      on('sector', (n) => setToast({ id: n, title: `Sector ${String(n).padStart(2, '0')}`, body: 'Hostile density rising' })),
    ];
    return () => offs.forEach((off) => off());
  }, [r]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className={`hud ${touch ? 'hud--touch' : ''}`}>
      <div ref={(n) => { r.damage = n; }} className="vignette vignette--damage" aria-hidden="true" />
      <div ref={(n) => { r.danger = n; }} className="vignette vignette--danger" aria-hidden="true" />

      <div ref={(n) => { r.crosshair = n; }} className="crosshair" aria-hidden="true">
        <span className="crosshair__ring" />
        <span className="crosshair__dot" />
        {pop && (
          <span key={pop.id} className="score-pop">
            +{pop.points}
            {pop.combo > 1 && <small> ×{pop.combo}</small>}
          </span>
        )}
      </div>

      <section className="hud__score" aria-label="Score">
        <p className="hud__label">Score</p>
        <p ref={(n) => { r.score = n; }} className="hud__value">
          0
        </p>
        <p className="hud__sub">
          Best <span ref={(n) => { r.best = n; }}>{best.toLocaleString()}</span>
        </p>
        <div ref={(n) => { r.combo = n; }} className="combo" aria-hidden="true">
          <span ref={(n) => { r.comboValue = n; }} className="combo__value">
            ×1
          </span>
          <span className="combo__label">Chain</span>
          <span className="combo__timer" />
        </div>
      </section>

      <div className="hud__sector" aria-hidden="true">
        Sector <span ref={(n) => { r.sector = n; }}>01</span>
      </div>

      <div className="hud__actions">
        <button type="button" className="icon-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
          {muted ? <MuteIcon /> : <SoundIcon />}
        </button>
        <button type="button" className="icon-btn" onClick={onPause} aria-label="Pause game">
          <PauseIcon />
        </button>
      </div>

      <section className="hud__systems" aria-label="Ship systems">
        <div className="gauge">
          <span className="gauge__label">Hull</span>
          <div ref={(n) => { r.hull = n; }} className="hull-pips">
            {Array.from({ length: ship.hull }, (_, i) => (
              <i key={i} style={{ '--ship': ship.color }} />
            ))}
          </div>
        </div>
        <div ref={(n) => { r.boost = n; }} className="gauge gauge--boost">
          <span className="gauge__label">Boost</span>
          <div className="bar">
            <span ref={(n) => { r.boostBar = n; }} className="bar__fill" />
          </div>
        </div>
        <div ref={(n) => { r.energy = n; }} className="gauge gauge--energy">
          <span className="gauge__label">
            Laser <em ref={(n) => { r.energyState = n; }} className="gauge__state" />
          </span>
          <div className="bar">
            <span ref={(n) => { r.energyBar = n; }} className="bar__fill" />
          </div>
        </div>
      </section>

      {toast && (
        <div key={toast.id} className="toast" role="status">
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </div>
      )}

      {hints && !touch && (
        <div className="hints" aria-hidden="true">
          <span>
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd> Steer
          </span>
          <span>
            <Kbd>Space</Kbd> Fire
          </span>
          <span>
            <Kbd>Shift</Kbd> Boost
          </span>
          <span>
            <Kbd>Esc</Kbd> Pause
          </span>
        </div>
      )}
    </div>
  );
}
