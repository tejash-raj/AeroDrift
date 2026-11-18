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
  const [hurt, setHurt] = useState(null);
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

      const hp = Math.ceil(h.health);
      set('health', hp, (v) => {
        const frac = v / ship.maxHealth;
        r.healthBar.style.transform = `scaleX(${frac})`;
        r.healthValue.textContent = v;
        r.health.dataset.level = frac <= RULES.lowHealth ? 'low' : frac <= 0.6 ? 'mid' : 'ok';
        r.danger.classList.toggle('is-on', frac <= RULES.lowHealth && v > 0);
      });

      set('boost', Math.round(h.boost), (v) => (r.boostBar.style.transform = `scaleX(${v / 100})`));
      set('boostLocked', h.boostLocked, (v) => r.boost.classList.toggle('is-locked', v));
      set('boosting', h.boosting, (v) => r.boost.classList.toggle('is-active', v));

      const ammo = Math.floor(h.ammo);
      set('ammo', ammo, (v) => {
        const frac = v / ship.maxAmmo;
        r.ammoBar.style.transform = `scaleX(${frac})`;
        r.ammoValue.textContent = v;
        r.ammo.dataset.level = v < 1 ? 'empty' : frac <= 0.2 ? 'low' : 'ok';
      });
      set('outOfAmmo', h.outOfAmmo, (v) => (r.ammoState.textContent = v ? 'Empty' : ''));

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
      on('damage', ({ amount }) => {
        pulse(r.damage, 'is-flash');
        pulse(r.health, 'is-shake');
        setHurt({ id: Math.random(), amount });
      }),
      on('pickup', ({ type, amount }) => {
        pulse(type === 'health' ? r.health : r.ammo, 'is-gain');
        setPop({ id: Math.random(), text: `+${amount} ${type === 'health' ? 'hull' : 'ammo'}`, kind: type });
      }),
      on('hit', () => pulse(r.crosshair, 'is-hit')),
      on('kill', ({ points, combo }) => {
        pulse(r.crosshair, 'is-kill');
        setPop({ id: Math.random(), points, combo, kind: 'score' });
      }),
      on('sector', (n) =>
        setToast({
          id: n,
          title: `Sector ${String(n).padStart(2, '0')}`,
          body: n === RULES.enemyFireSector ? 'Saucers shoot back — dodge the red bolts' : 'Faster flight, more hostiles',
        }),
      ),
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
          <span key={pop.id} className={`score-pop score-pop--${pop.kind}`}>
            {pop.text ?? `+${pop.points}`}
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
        <div ref={(n) => { r.health = n; }} className="gauge gauge--health" data-level="ok">
          <span className="gauge__label">
            Hull <b ref={(n) => { r.healthValue = n; }} className="gauge__value">{ship.maxHealth}</b>
          </span>
          <div className="bar bar--thick">
            <span ref={(n) => { r.healthBar = n; }} className="bar__fill" />
          </div>
          {hurt && (
            <span key={hurt.id} className="hurt-pop">
              −{hurt.amount}
            </span>
          )}
        </div>
        <div ref={(n) => { r.boost = n; }} className="gauge gauge--boost">
          <span className="gauge__label">Boost</span>
          <div className="bar">
            <span ref={(n) => { r.boostBar = n; }} className="bar__fill" />
          </div>
        </div>
        <div ref={(n) => { r.ammo = n; }} className="gauge gauge--ammo" data-level="ok">
          <span className="gauge__label">
            Ammo <em ref={(n) => { r.ammoState = n; }} className="gauge__state" />
            <b ref={(n) => { r.ammoValue = n; }} className="gauge__value">{ship.maxAmmo}</b>
          </span>
          <div className="bar">
            <span ref={(n) => { r.ammoBar = n; }} className="bar__fill" />
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
