import { useEffect, useState } from 'react';
import { SHIPS } from '../game/config';
import { game } from '../game/state';
import { audio } from '../game/audio';
import { RetryIcon, ShareIcon } from './Icons';
import { Kbd, Modal, Segmented, Slider, Toggle } from './primitives';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── Pause ───────────────────────────────────────────────────
export function PauseMenu({ onResume, onRestart, onSettings, onQuit, touch }) {
  return (
    <Modal
      eyebrow={`Sector ${String(game.sector).padStart(2, '0')} · ${fmtTime(game.time)}`}
      title="Paused"
      size="sm"
      footer={null}
    >
      <div className="stack">
        <button type="button" className="btn btn--primary btn--lg" onClick={onResume} data-autofocus>
          Resume {!touch && <Kbd>Esc</Kbd>}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRestart}>
          Restart run
        </button>
        <button type="button" className="btn btn--ghost" onClick={onSettings}>
          Settings
        </button>
        <button type="button" className="btn btn--quiet" onClick={onQuit}>
          Quit to hangar
        </button>
      </div>
    </Modal>
  );
}

// ── Game over ───────────────────────────────────────────────
export function GameOver({ run, best, onRetry, onMenu, touch }) {
  const [shareState, setShareState] = useState('idle');
  const ship = SHIPS[run.ship];

  const share = async () => {
    const text = `I scored ${run.score.toLocaleString()} in AeroDrift (sector ${run.sector}, ${ship.name}). Can you beat it?`;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AeroDrift', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareState('copied');
    } catch {
      setShareState('failed');
    }
  };

  useEffect(() => {
    if (shareState === 'idle') return;
    const t = setTimeout(() => setShareState('idle'), 2200);
    return () => clearTimeout(t);
  }, [shareState]);

  const stats = [
    ['Kills', run.kills],
    ['Accuracy', `${Math.round(run.accuracy * 100)}%`],
    ['Survived', fmtTime(run.time)],
    ['Sector', run.sector],
    ['Chain', `×${run.maxCombo}`],
  ];

  return (
    // Focus lands on "Fly again" after a short delay, so a fire button still
    // held from the crash can't instantly trigger a retry.
    <Modal eyebrow="Mission failed" title="Ship down" size="sm" initialFocusDelay={700}>
      <div className="result">
        <p className="result__label">Final score</p>
        <p className="result__score">{run.score.toLocaleString()}</p>
        {run.isBest ? (
          <p className="badge badge--best">New personal best</p>
        ) : (
          <p className="result__best">Personal best {best.toLocaleString()}</p>
        )}
      </div>
      <dl className="stats">
        {stats.map(([k, v]) => (
          <div key={k} className="stats__item">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="stack">
        <button type="button" className="btn btn--primary btn--lg" onClick={onRetry} data-autofocus>
          <RetryIcon size={18} /> Fly again {!touch && <Kbd>R</Kbd>}
        </button>
        <div className="row">
          <button type="button" className="btn btn--ghost" onClick={onMenu}>
            Change ship
          </button>
          <button type="button" className="btn btn--ghost" onClick={share} aria-live="polite">
            <ShareIcon size={16} />
            {shareState === 'copied' ? 'Copied!' : shareState === 'failed' ? 'Couldn’t share' : 'Share score'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Settings ────────────────────────────────────────────────
export function SettingsPanel({ settings, onChange, onClose, onResetBest, best }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (key) => (value) => onChange({ ...settings, [key]: value });

  return (
    <Modal eyebrow="Options" title="Settings" onClose={onClose} size="md">
      <section className="settings-group">
        <h3 className="settings-group__title">Audio</h3>
        <Toggle label="Sound" hint="Press M at any time" checked={!settings.muted} onChange={(v) => set('muted')(!v)} />
        <Slider label="Master volume" value={settings.master} onChange={set('master')} disabled={settings.muted} />
        <Slider label="Music" value={settings.music} onChange={set('music')} disabled={settings.muted} />
        <Slider label="Effects" value={settings.sfx} onChange={set('sfx')} disabled={settings.muted} />
      </section>

      <section className="settings-group">
        <h3 className="settings-group__title">Display</h3>
        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">Graphics</span>
          <Segmented
            label="Graphics quality"
            value={settings.quality}
            onChange={set('quality')}
            options={[
              { value: 'high', label: 'High detail' },
              { value: 'low', label: 'Battery saver' },
            ]}
          />
        </div>
        <Toggle label="Screen shake" hint="Camera kick on hits and explosions" checked={settings.screenShake} onChange={set('screenShake')} />
        <Toggle
          label="Reduce motion"
          hint="Calmer camera, no shake, shorter animations"
          checked={settings.reducedMotion}
          onChange={set('reducedMotion')}
        />
      </section>

      <section className="settings-group">
        <h3 className="settings-group__title">Controls</h3>
        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">Control scheme</span>
          <Segmented
            label="Control scheme"
            value={settings.controlMode}
            onChange={set('controlMode')}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'keyboard', label: 'Keyboard' },
              { value: 'touch', label: 'Touch' },
            ]}
          />
        </div>
        <Toggle label="Invert vertical" hint="Push up to dive, like a flight stick" checked={settings.invertY} onChange={set('invertY')} />
        <Toggle label="Control hints" hint="Show reminders at the start of each run" checked={settings.showHints} onChange={set('showHints')} />
      </section>

      <section className="settings-group">
        <h3 className="settings-group__title">Data</h3>
        <div className="setting-row">
          <div className="setting-row__text">
            <span className="setting-row__label">Personal best</span>
            <span className="setting-row__hint">{best.toLocaleString()} · saved on this device</span>
          </div>
          <button
            type="button"
            className={`btn btn--sm ${confirmReset ? 'btn--danger' : 'btn--ghost'}`}
            disabled={best === 0}
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              onResetBest();
              setConfirmReset(false);
              audio.synth('deny');
            }}
            onBlur={() => setConfirmReset(false)}
          >
            {confirmReset ? 'Tap again to reset' : 'Reset'}
          </button>
        </div>
      </section>
    </Modal>
  );
}

// ── How to play ─────────────────────────────────────────────
export function HowToPlay({ touch, firstRun, onClose, onLaunch }) {
  const cards = touch
    ? [
        ['Steer', 'Drag anywhere on the left half of the screen. The stick appears under your thumb.'],
        ['Shoot', 'Hold FIRE. Your laser drains energy; stop firing and it refills fast.'],
        ['Boost', 'Hold BOOST to double your speed. An empty tank locks until it recharges.'],
      ]
    : [
        ['Steer', <>Use <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> or the arrow keys to fly.</>],
        ['Shoot', <>Hold <Kbd>Space</Kbd>. Your laser drains energy; stop firing and it refills fast.</>],
        ['Boost', <>Hold <Kbd>Shift</Kbd> to double your speed. An empty tank locks until it recharges.</>],
      ];

  return (
    <Modal
      eyebrow={firstRun ? 'Before you launch' : 'Flight manual'}
      title="How to play"
      onClose={onClose}
      size="md"
      footer={
        <button type="button" className="btn btn--primary btn--lg" onClick={firstRun ? onLaunch : onClose} data-autofocus>
          {firstRun ? 'Got it — launch' : 'Got it'}
        </button>
      }
    >
      <ol className="howto">
        {cards.map(([title, body], i) => (
          <li key={title} className="howto__card">
            <span className="howto__num">{String(i + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
      <ul className="tips">
        <li>
          <b>Rocks</b> break in one hit. <b>Large rocks</b> and <b>saucers</b> take two. A saucer’s dome turns red once it
          is damaged.
        </li>
        <li>
          Chain kills within 2.5 seconds to build a <b>multiplier up to ×5</b>. Taking a hit resets it.
        </li>
        <li>Every 30 seconds you enter a new sector. Enemies get denser and you fly faster.</li>
        <li>
          After a hit your hull flashes. You can’t be damaged again for a moment, so use it to escape.
        </li>
      </ul>
    </Modal>
  );
}

// ── Briefing ────────────────────────────────────────────────
export function Briefing({ onClose }) {
  return (
    <Modal
      eyebrow="Classified · Ocean Defence Program"
      title="Mission briefing"
      onClose={onClose}
      size="md"
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose} data-autofocus>
          Understood
        </button>
      }
    >
      <div className="prose">
        <p>
          Seventy-two hours ago an alien strike shattered the moon. Its fragments are now falling as a slow, endless
          shower, and the oceans are taking the impacts. Every rock that lands raises the sea and pushes the coastlines
          back.
        </p>
        <p>
          The aliens are sending saucers through the debris to speed it up. You fly one of three experimental ships
          built for the last line of defence, just above the waves.
        </p>
        <p>
          <b>Your orders:</b> fly as far as you can. Break the rocks, bring down the saucers, and keep an eye on your
          laser energy. Nobody expects you to win. They need you to hold out as long as possible.
        </p>
      </div>
    </Modal>
  );
}
