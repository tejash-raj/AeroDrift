// ─────────────────────────────────────────────────────────────
// Audio engine built on the Web Audio API (AudioContext).
//
//  • Files are decoded once into AudioBuffers, so overlapping shots
//    and explosions never cut each other off.
//  • Music loops sample-accurately; MP3 encoder padding is trimmed
//    so the loop has no audible gap.
//  • A low-pass filter on the music bus reflects game state:
//    muffled in menus / pause, wide open in flight.
//  • UI sounds are synthesised — zero extra downloads.
//  • The context is created on the first user gesture, which is
//    the only reliable way past browser autoplay policies.
// ─────────────────────────────────────────────────────────────

const BASE = import.meta.env?.BASE_URL ?? './';
const FILES = { laser: 'laser.mp3', explosion: 'explosion.mp3', music: 'bg-music.mp3' };
const MAX_VOICES = { laser: 10, explosion: 8 };
const MOOD_CUTOFF = { menu: 1100, playing: 18000, paused: 650, gameover: 480 };

function findLoopPoints(buffer, threshold = 0.002) {
  const data = buffer.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  return { loopStart: start / buffer.sampleRate, loopEnd: end / buffer.sampleRate };
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.voices = { laser: 0, explosion: 0 };
    this.music = null;
    this.wantMusic = false;
    this.mood = 'menu';
    this.volumes = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Call from any user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.connect(c.destination);

      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = MOOD_CUTOFF[this.mood];
      this.musicGain = c.createGain();
      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.master);

      this.sfxGain = c.createGain();
      this.sfxGain.connect(this.master);

      this.applyVolumes(true);
      this.loadAll();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  async loadAll() {
    await Promise.all(
      Object.entries(FILES).map(async ([name, file]) => {
        try {
          const res = await fetch(BASE + file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          this.buffers[name] = await this.ctx.decodeAudioData(data);
        } catch (err) {
          console.warn(`[audio] ${file} unavailable — continuing without it.`, err);
        }
      }),
    );
    if (this.wantMusic) this.startMusic();
  }

  applyVolumes(instant = false) {
    if (!this.ctx) return;
    const v = this.volumes;
    const now = this.ctx.currentTime;
    const tc = instant ? 0.001 : 0.06;
    this.master.gain.setTargetAtTime(v.muted ? 0 : v.master, now, tc);
    this.musicGain.gain.setTargetAtTime(v.music * 0.55, now, tc);
    this.sfxGain.gain.setTargetAtTime(v.sfx, now, tc);
  }

  setVolumes(partial) {
    Object.assign(this.volumes, partial);
    this.applyVolumes();
  }

  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.music || !this.buffers.music) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.music;
    const { loopStart, loopEnd } = findLoopPoints(src.buffer);
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    src.connect(this.musicFilter);
    src.start(0, loopStart);
    this.music = src;
    this.setMood(this.mood, true);
  }

  /** menu | playing | paused | gameover */
  setMood(mood, instant = false) {
    this.mood = mood;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const f = this.musicFilter.frequency;
    f.cancelScheduledValues(now);
    f.setTargetAtTime(MOOD_CUTOFF[mood] ?? 18000, now, instant ? 0.001 : 0.25);
    if (this.music) {
      // tape-stop feel on game over, back to normal everywhere else
      this.music.playbackRate.setTargetAtTime(mood === 'gameover' ? 0.86 : 1, now, 0.5);
    }
  }

  play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.ready) return;
    const buffer = this.buffers[name];
    if (!buffer) return;
    if (MAX_VOICES[name] && this.voices[name] >= MAX_VOICES[name]) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.sfxGain);
    if (name in this.voices) {
      this.voices[name]++;
      src.onended = () => {
        this.voices[name]--;
      };
    }
    src.start();
  }

  noiseBuffer() {
    if (!this._noise) {
      const len = this.ctx.sampleRate * 0.6;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = b;
    }
    return this._noise;
  }

  /** Procedural UI / feedback sounds */
  synth(kind) {
    if (!this.ready) return;
    const c = this.ctx;
    const now = c.currentTime;
    const out = this.sfxGain;

    const tone = (freq, dur, { type = 'sine', vol = 0.15, slideTo = null, delay = 0 } = {}) => {
      const o = c.createOscillator();
      const g = c.createGain();
      const t0 = now + delay;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    };

    switch (kind) {
      case 'hover':
        tone(1200, 0.03, { type: 'sine', vol: 0.03 });
        break;
      case 'click':
        tone(880, 0.06, { type: 'triangle', vol: 0.1 });
        break;
      case 'select':
        tone(660, 0.05, { type: 'triangle', vol: 0.08 });
        tone(990, 0.08, { type: 'triangle', vol: 0.08, delay: 0.05 });
        break;
      case 'launch':
        tone(220, 0.5, { type: 'sawtooth', vol: 0.05, slideTo: 880 });
        tone(660, 0.25, { type: 'triangle', vol: 0.08, delay: 0.35 });
        break;
      case 'tick':
        tone(1500, 0.05, { type: 'square', vol: 0.04, slideTo: 900 });
        break;
      case 'deny':
        tone(240, 0.12, { type: 'square', vol: 0.05, slideTo: 150 });
        break;
      case 'chime':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.4, { vol: 0.09, delay: i * 0.08 }));
        break;
      case 'thud':
        tone(130, 0.4, { type: 'sine', vol: 0.45, slideTo: 38 });
        break;
      case 'whoosh': {
        const src = c.createBufferSource();
        src.buffer = this.noiseBuffer();
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(300, now);
        bp.frequency.exponentialRampToValueAtTime(2600, now + 0.45);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        src.connect(bp);
        bp.connect(g);
        g.connect(out);
        src.start(now);
        src.stop(now + 0.6);
        break;
      }
      default:
        break;
    }
  }
}

export const audio = new AudioEngine();
