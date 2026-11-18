import { useCallback, useEffect, useRef, useState } from 'react';
import GameScene from './scene/GameScene';
import BootScreen from './ui/BootScreen';
import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import TouchControls from './ui/TouchControls';
import { Briefing, GameOver, HowToPlay, PauseMenu, SettingsPanel } from './ui/Overlays';
import { DEFAULT_SETTINGS, SHIPS, TIMES, isCoarsePointer } from './game/config';
import { clearInput, game, input } from './game/state';
import { clearField, resetGame } from './game/simulation';
import { audio } from './game/audio';
import { on } from './game/events';
import { load, save } from './game/storage';

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'fire',
  KeyJ: 'fire',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  KeyK: 'boost',
};

const PHASE = { boot: 'menu', menu: 'menu', playing: 'playing', paused: 'paused', gameover: 'gameover' };

export default function App() {
  // screen: boot → menu → playing ⇄ paused → gameover
  const [screen, setScreen] = useState('boot');
  const [panel, setPanel] = useState(null); // settings | howto | howto-first | briefing
  const [shipKey, setShipKey] = useState(() => (SHIPS[load('ship')] ? load('ship') : 'defender'));
  const [timeKey, setTimeKey] = useState(() => (TIMES[load('time')] ? load('time') : 'day'));
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load('settings', {}) }));
  const [best, setBest] = useState(() => Number(load('best', 0)) || 0);
  const [run, setRun] = useState(null);
  const [lastInput, setLastInput] = useState(isCoarsePointer ? 'touch' : 'keyboard');

  const touch = (settings.controlMode === 'auto' ? lastInput : settings.controlMode) === 'touch';
  const gameOverAt = useRef(0);
  const bestRef = useRef(best);
  bestRef.current = best;

  // ── persistence ──────────────────────────────────────────
  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('ship', shipKey), [shipKey]);
  useEffect(() => save('time', timeKey), [timeKey]);

  // ── settings → engine ───────────────────────────────────
  useEffect(() => {
    game.settings.screenShake = settings.screenShake;
    game.settings.reducedMotion = settings.reducedMotion;
    game.settings.invertY = settings.invertY;
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
    document.documentElement.classList.toggle('quality-low', settings.quality === 'low');
  }, [settings]);

  // ── screen → simulation phase + music mood ──────────────
  useEffect(() => {
    game.phase = PHASE[screen];
    audio.setMood(PHASE[screen]);
  }, [screen]);

  // ── actions ─────────────────────────────────────────────
  const startRun = useCallback(() => {
    audio.unlock();
    audio.startMusic();
    audio.synth('launch');
    clearInput();
    resetGame(shipKey);
    game.phase = 'playing';
    setPanel(null);
    setRun(null);
    setScreen('playing');
    document.activeElement?.blur?.();
  }, [shipKey]);

  const launch = useCallback(() => {
    if (!load('onboarded', false)) {
      setPanel('howto-first');
      return;
    }
    startRun();
  }, [startRun]);

  const pause = useCallback(() => {
    if (game.hero.dead) return; // can't pause during the crash beat before results
    clearInput();
    game.phase = 'paused';
    setScreen('paused');
    audio.synth('click');
  }, []);

  const resume = useCallback(() => {
    clearInput();
    setPanel(null);
    game.phase = 'playing';
    setScreen('playing');
    document.activeElement?.blur?.();
  }, []);

  const toMenu = useCallback(() => {
    clearInput();
    clearField();
    game.phase = 'menu';
    setPanel(null);
    setScreen('menu');
  }, []);

  const toggleMute = useCallback(() => setSettings((s) => ({ ...s, muted: !s.muted })), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const openPanel = useCallback((p) => {
    audio.synth('click');
    setPanel(p);
  }, []);

  // ── game events ─────────────────────────────────────────
  useEffect(
    () =>
      on('gameover', (stats) => {
        const isBest = stats.score > bestRef.current;
        if (isBest) {
          setBest(stats.score);
          save('best', stats.score);
        }
        gameOverAt.current = performance.now();
        clearInput();
        setRun({ ...stats, isBest });
        // let the explosion play for a beat before the results card
        setTimeout(() => setScreen((s) => (s === 'playing' ? 'gameover' : s)), 900);
      }),
    [],
  );

  // ── input-device detection (last input wins) ─────────────
  useEffect(() => {
    const onPointer = (e) => {
      audio.unlock();
      audio.startMusic();
      setLastInput(e.pointerType === 'touch' ? 'touch' : 'keyboard');
    };
    const onKey = () => {
      audio.unlock();
      audio.startMusic();
      setLastInput('keyboard');
    };
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // ── auto-pause when the tab or window loses focus ───────
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    const away = () => {
      clearInput();
      if (screenRef.current === 'playing') pause();
    };
    const onVis = () => document.hidden && away();
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pause]);

  // ── keyboard ────────────────────────────────────────────
  const live = useRef({});
  live.current = { screen, panel, launch, startRun, pause, resume, toMenu, toggleMute, closePanel };
  useEffect(() => {
    const down = (e) => {
      const s = live.current;
      const action = KEYMAP[e.code];
      if (s.screen === 'playing' && action) {
        input.keys[action] = true;
        e.preventDefault(); // no page scroll, no accidental button presses
        return;
      }
      if (e.repeat) return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (s.panel) s.closePanel();
        else if (s.screen === 'playing') s.pause();
        else if (s.screen === 'paused') s.resume();
        return;
      }
      if (e.code === 'KeyM') {
        s.toggleMute();
        return;
      }

      const onBody = e.target === document.body || e.target === document.documentElement;
      const graceOver = performance.now() - gameOverAt.current > 800;
      if (s.screen === 'gameover' && graceOver && (e.code === 'KeyR' || (onBody && e.code === 'Enter'))) {
        e.preventDefault();
        s.startRun();
      } else if (s.screen === 'menu' && !s.panel && onBody && e.code === 'Enter') {
        e.preventDefault();
        s.launch();
      }
    };
    const up = (e) => {
      const action = KEYMAP[e.code];
      if (action) input.keys[action] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const inFlight = screen === 'playing' || screen === 'paused';

  return (
    <div className={`app app--${screen}`}>
      <GameScene shipKey={shipKey} timeKey={timeKey} quality={settings.quality} />

      {screen === 'boot' && (
        <BootScreen onDone={() => setScreen('menu')} reducedMotion={settings.reducedMotion} touch={touch} />
      )}

      {screen === 'menu' && (
        <MainMenu
          shipKey={shipKey}
          onShip={setShipKey}
          timeKey={timeKey}
          onTime={setTimeKey}
          best={best}
          onLaunch={launch}
          onOpen={openPanel}
          touch={touch}
        />
      )}

      {inFlight && (
        <HUD
          best={best}
          touch={touch}
          showHints={settings.showHints}
          muted={settings.muted}
          onPause={pause}
          onToggleMute={toggleMute}
        />
      )}
      {screen === 'playing' && touch && <TouchControls showHints={settings.showHints} />}

      {screen === 'paused' && !panel && (
        <PauseMenu onResume={resume} onRestart={startRun} onSettings={() => openPanel('settings')} onQuit={toMenu} touch={touch} />
      )}

      {screen === 'gameover' && run && <GameOver run={run} best={best} onRetry={startRun} onMenu={toMenu} touch={touch} />}

      {panel === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={closePanel}
          best={best}
          onResetBest={() => {
            setBest(0);
            save('best', 0);
          }}
        />
      )}
      {(panel === 'howto' || panel === 'howto-first') && (
        <HowToPlay
          touch={touch}
          firstRun={panel === 'howto-first'}
          onClose={closePanel}
          onLaunch={() => {
            save('onboarded', true);
            startRun();
          }}
        />
      )}
      {panel === 'briefing' && <Briefing onClose={closePanel} />}
    </div>
  );
}
