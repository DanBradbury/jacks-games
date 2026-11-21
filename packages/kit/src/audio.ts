// Synthesized sound effects (WebAudio). No audio files, so bundles stay tiny
// and nothing is fetched at runtime.

export interface ScratchProfile {
  type: BiquadFilterType;
  freq: number;
  q: number;
  gain: number;
}

/** Looping "drawing" noise profiles for different art tools. */
export const SCRATCH: Record<string, ScratchProfile> = {
  fineliner: { type: 'bandpass', freq: 3400, q: 1.1, gain: 0.16 },
  marker: { type: 'bandpass', freq: 1700, q: 0.8, gain: 0.2 },
  crayon: { type: 'bandpass', freq: 1100, q: 0.6, gain: 0.32 },
  paintstick: { type: 'lowpass', freq: 650, q: 3, gain: 0.34 },
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slide?: number;
  attack?: number;
}

interface NoiseOpts {
  type?: BiquadFilterType;
  freq?: number;
  sweep?: number;
  q?: number;
  gain?: number;
  delay?: number;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private scratch: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  private enabled = true;
  private paused = false;
  private volume = 0.8;

  /** Create/resume the AudioContext. Call from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.02);
  }

  pause() {
    this.paused = true;
    void this.ctx?.suspend();
  }

  resume() {
    this.paused = false;
    void this.ctx?.resume();
  }

  tone(freq: number, dur: number, o: ToneOpts = {}) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur: number, o: NoiseOpts = {}) {
    const c = this.ctx;
    if (!c || !this.master || !this.noiseBuf) return;
    const t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** Continuous drawing sound; call every frame with 0..1 intensity. */
  setScratch(level: number, p: ScratchProfile) {
    const c = this.ctx;
    if (!c || !this.master || !this.noiseBuf) return;
    if (!this.scratch) {
      if (level <= 0) return;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filter = c.createBiquadFilter();
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      this.scratch = { filter, gain };
    }
    const { filter, gain } = this.scratch;
    const t = c.currentTime;
    filter.type = p.type;
    filter.Q.value = p.q;
    filter.frequency.setTargetAtTime(p.freq * (0.9 + Math.random() * 0.2), t, 0.03);
    gain.gain.setTargetAtTime(Math.max(0, level) * p.gain, t, 0.04);
  }

  // ---- presets -----------------------------------------------------------

  tap() {
    this.tone(640, 0.09, { type: 'triangle', gain: 0.2, slide: 900 });
  }

  pop(step = 0) {
    const f = midi(72 + step);
    this.tone(f, 0.14, { gain: 0.32, slide: f * 1.7 });
    this.noise(0.05, { freq: 3500, gain: 0.06 });
  }

  boop() {
    this.tone(330, 0.2, { gain: 0.25, slide: 220 });
  }

  tick() {
    this.tone(midi(84), 0.08, { type: 'triangle', gain: 0.12 });
  }

  whoosh() {
    this.noise(0.35, { freq: 500, sweep: 3200, q: 0.8, gain: 0.2 });
  }

  /** Tiny success (e.g. one line drawn). Pitch climbs with `step`. */
  sparkle(step = 0) {
    const base = 72 + [0, 2, 4, 7, 9, 12][step % 6];
    this.tone(midi(base), 0.25, { type: 'triangle', gain: 0.2 });
    this.tone(midi(base + 7), 0.35, { type: 'triangle', gain: 0.16, delay: 0.08 });
    this.tone(midi(base + 24), 0.3, { gain: 0.05, delay: 0.16 });
  }

  /** Small success: a section was finished. */
  chime() {
    [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), 0.5, { type: 'triangle', gain: 0.2, delay: i * 0.07 }));
    this.tone(midi(96), 0.6, { gain: 0.06, delay: 0.28 });
  }

  /** Big success: the whole level is done. */
  fanfare() {
    [60, 64, 67, 72, 76, 79].forEach((n, i) => this.tone(midi(n), 0.3, { type: 'triangle', gain: 0.18, delay: i * 0.08 }));
    [72, 76, 79, 84].forEach((n) => this.tone(midi(n), 1.2, { type: 'triangle', gain: 0.12, delay: 0.5, attack: 0.02 }));
    for (let i = 0; i < 6; i++) this.tone(midi(96 + (i % 3) * 4), 0.25, { gain: 0.05, delay: 0.55 + i * 0.09 });
  }
}
