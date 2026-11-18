import { SHIPS, SHIP_ORDER, TIMES, TIME_ORDER, PORTFOLIO_URL } from '../game/config';
import { audio } from '../game/audio';
import { ArrowOutIcon, BookIcon, GearIcon, HelpIcon, TIME_ICONS } from './Icons';
import { Kbd, Segmented, useRadioKeys } from './primitives';

function Meter({ label, short, value }) {
  return (
    <span className="meter">
      <span className="meter__label" aria-hidden="true">
        <span className="meter__full">{label}</span>
        <span className="meter__short">{short}</span>
      </span>
      <span className="meter__pips" role="img" aria-label={`${label} ${value} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={n <= value ? 'is-on' : ''} />
        ))}
      </span>
    </span>
  );
}

export default function MainMenu({ shipKey, onShip, timeKey, onTime, best, onLaunch, onOpen, touch }) {
  const shipKeys = useRadioKeys(SHIP_ORDER, shipKey, (k) => {
    audio.synth('select');
    onShip(k);
  });

  return (
    <main className="menu" aria-labelledby="menu-title">
      <section className="menu__panel panel">
        <header className="menu__brand">
          <p className="eyebrow">Ocean Defence Program</p>
          <h1 id="menu-title" className="wordmark">
            AERO<span>DRIFT</span>
          </h1>
          <p className="menu__tagline">The moon shattered. The sky is falling. Hold the line above the ocean.</p>
        </header>

        <div className="field">
          <h2 className="field__label" id="ship-label">
            Choose your ship
          </h2>
          <div className="ship-list" role="radiogroup" aria-labelledby="ship-label" onKeyDown={shipKeys}>
            {SHIP_ORDER.map((key) => {
              const s = SHIPS[key];
              const active = key === shipKey;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  data-value={key}
                  className="ship-card"
                  style={{ '--ship': s.color }}
                  onClick={() => {
                    if (!active) audio.synth('select');
                    onShip(key);
                  }}
                >
                  <span className="ship-card__head">
                    <span className="ship-card__name">{s.name}</span>
                    <span className="tag">{s.role}</span>
                  </span>
                  <span className="ship-card__desc">
                    {s.description}
                    {s.scoreMul > 1 && <span className="ship-card__bonus"> Earns ×{s.scoreMul} points.</span>}
                  </span>
                  <span className="ship-card__meters">
                    <Meter label="Speed" short="Spd" value={s.stats.speed} />
                    <Meter label="Handling" short="Hnd" value={s.stats.handling} />
                    <Meter label="Armour" short="Arm" value={s.stats.hull} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <h2 className="field__label">Time of day</h2>
          <Segmented
            label="Time of day"
            value={timeKey}
            onChange={onTime}
            options={TIME_ORDER.map((k) => ({ value: k, label: TIMES[k].label }))}
            renderOption={(o) => {
              const I = TIME_ICONS[o.value];
              return (
                <>
                  <I size={16} />
                  <span>{o.label}</span>
                </>
              );
            }}
          />
        </div>

        <button type="button" className="btn btn--primary btn--xl" onClick={onLaunch}>
          <span>Launch</span>
          {!touch && <Kbd>Enter</Kbd>}
        </button>

        <div className="menu__row">
          <nav className="menu__links" aria-label="More">
            <button type="button" className="link-btn" onClick={() => onOpen('howto')}>
              <HelpIcon size={16} /> How to play
            </button>
            <button type="button" className="link-btn" onClick={() => onOpen('settings')}>
              <GearIcon size={16} /> Settings
            </button>
            <button type="button" className="link-btn" onClick={() => onOpen('briefing')}>
              <BookIcon size={16} /> Briefing
            </button>
          </nav>
          <p className="menu__best">
            Best <strong>{best.toLocaleString()}</strong>
          </p>
        </div>
      </section>

      <footer className="credit">
        <span className="credit__by">
          <span className="credit__lead">Designed &amp; developed by </span>
          <strong>Tejash Raj</strong>
          <span className="credit__school"> · M.Des, IIT Guwahati</span>
        </span>
        <a className="credit__link" href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">
          See more work <ArrowOutIcon size={14} />
        </a>
      </footer>
    </main>
  );
}
