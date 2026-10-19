/* Procedural WebAudio: buses, SFX, a looping tune and gibberish "voices". No audio files needed. */

type Voice = 'frog' | 'fly' | 'mosquito';

const dB = (db: number) => Math.pow(10, db / 20);

class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private musicOn = true;
  private sfxOn = true;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private musicWanted = false;
  private suspendedBy = new Set<string>();
  private noise: AudioBuffer | null = null;
  private lastPlay = new Map<string, number>();
  tempo = 1;

  /** Must be called from a user gesture (first tap). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = dB(-3);
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.gain.value = this.musicOn ? dB(-14) : 0;
      this.sfx.gain.value = this.sfxOn ? dB(-4) : 0;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.musicWanted) this.startMusic();
    }
    if (this.ctx.state === 'suspended' && this.suspendedBy.size === 0) this.ctx.resume().catch(() => undefined);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? dB(-14) : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? dB(-4) : 0, this.ctx.currentTime, 0.05);
  }

  /** Reasons: 'hidden', 'ad', 'pause'... audio resumes only when every reason is cleared. */
  suspend(reason: string) {
    this.suspendedBy.add(reason);
    this.ctx?.suspend().catch(() => undefined);
  }

  resume(reason: string) {
    this.suspendedBy.delete(reason);
    if (this.ctx && this.suspendedBy.size === 0) this.ctx.resume().catch(() => undefined);
  }

  private ok(name: string, minGapMs = 30) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return false;
    const now = performance.now();
    if (now - (this.lastPlay.get(name) ?? 0) < minGapMs) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    when = 0,
    dest: AudioNode = this.sfx,
    attack = 0.005,
  ) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, freq: number, q = 1, when = 0, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private jitter(v: number, pct = 0.06) {
    return v * (1 + (Math.random() * 2 - 1) * pct);
  }

  tongue() {
    if (!this.ok('tongue', 40)) return;
    this.tone('sine', this.jitter(300), 900, 0.09, 0.35);
    this.noiseBurst(0.07, 0.2, 2500, 2);
  }

  gulp(fat = 0) {
    if (!this.ok('gulp', 40)) return;
    const base = this.jitter(260 - fat * 25);
    this.tone('sine', base, base * 0.45, 0.16, 0.6);
    this.tone('triangle', base * 1.5, base * 0.7, 0.12, 0.25, 0.06);
  }

  lick() {
    if (!this.ok('lick', 40)) return;
    this.noiseBurst(0.14, 0.35, 1800, 3);
    this.tone('sine', this.jitter(700), 400, 0.12, 0.2, 0.02);
  }

  blush() {
    if (!this.ok('blush', 60)) return;
    this.tone('sine', this.jitter(900), 1500, 0.18, 0.18);
    this.tone('sine', this.jitter(1200), 2000, 0.16, 0.12, 0.08);
  }

  miss() {
    if (!this.ok('miss', 80)) return;
    this.tone('square', 140, 110, 0.12, 0.12);
  }

  combo(n: number) {
    if (!this.ok('combo', 60)) return;
    const f = 520 * Math.pow(2, Math.min(n, 12) / 12);
    this.tone('triangle', f, f, 0.12, 0.25);
    this.tone('triangle', f * 1.5, f * 1.5, 0.12, 0.18, 0.06);
  }

  pair() {
    if (!this.ok('pair', 60)) return;
    [660, 880, 1320].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.25, i * 0.06));
  }

  tick(urgent = false) {
    if (!this.ok('tick', 200)) return;
    this.tone('square', urgent ? 1200 : 900, urgent ? 1200 : 900, 0.04, 0.12);
  }

  click() {
    if (!this.ok('click', 40)) return;
    this.tone('sine', 600, 900, 0.06, 0.3);
  }

  poke() {
    if (!this.ok('poke', 120)) return;
    this.tone('sine', 300, 180, 0.15, 0.4);
    this.tone('sine', 500, 700, 0.1, 0.2, 0.1);
  }

  puff() {
    if (!this.ok('puff', 40)) return;
    this.noiseBurst(0.2, 0.3, 600, 0.7, 0, 'lowpass');
  }

  spark(i = 0) {
    if (!this.ok('spark', 25)) return;
    const f = 1300 + (i % 8) * 90;
    this.tone('sine', f, f * 1.3, 0.07, 0.12);
  }

  fuse(tier: number) {
    if (!this.ok('fuse', 50)) return;
    const base = 440 * Math.pow(1.25, tier);
    [1, 1.25, 1.5, 2].forEach((m, i) => this.tone('triangle', base * m, base * m, 0.14, 0.22, i * 0.05));
  }

  epic() {
    if (!this.ok('epic', 200)) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.22, 0.12, i * 0.09));
    this.noiseBurst(0.6, 0.15, 5000, 0.5, 0.45, 'highpass');
  }

  star(i: number) {
    if (!this.ok('star' + i, 80)) return;
    const f = [659, 784, 988][i] ?? 784;
    this.tone('sine', f, f * 0.97, 0.42, 0.07, 0, this.sfx, 0.008);
    this.tone('triangle', f * 2.01, f * 1.95, 0.28, 0.035, 0.012);
    this.tone('sine', f * 3, f * 2.9, 0.16, 0.018, 0.02);
  }

  win() {
    if (!this.ok('win', 300)) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.3, i * 0.11));
  }

  fail() {
    if (!this.ok('fail', 300)) return;
    [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.97, 0.25, 0.28, i * 0.16));
  }

  hurry() {
    if (!this.ok('hurry', 500)) return;
    this.tone('square', 880, 880, 0.08, 0.1);
    this.tone('square', 880, 880, 0.08, 0.1, 0.12);
  }

  /** Funny gibberish speech: formant-filtered sawtooth syllables. */
  speak(voice: Voice, syllables = 3) {
    if (!this.ok('voice-' + voice, 260)) return;
    const ctx = this.ctx!;
    const base = voice === 'frog' ? this.jitter(170, 0.1) : voice === 'fly' ? this.jitter(480, 0.1) : this.jitter(820, 0.08);
    const sylDur = voice === 'frog' ? 0.11 : 0.075;
    const formants =
      voice === 'frog'
        ? [
            [600, 1000],
            [400, 800],
            [700, 1150],
          ]
        : [
            [800, 1800],
            [500, 2300],
            [1000, 2600],
          ];
    const t0 = ctx.currentTime + 0.01;
    for (let i = 0; i < syllables; i++) {
      const t = t0 + i * sylDur * 1.15;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const up = i === syllables - 1 ? 1.35 : 1 + (Math.random() - 0.3) * 0.3;
      o.frequency.setValueAtTime(base * (1 + (Math.random() - 0.5) * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * up, t + sylDur);
      const [f1, f2] = formants[Math.floor(Math.random() * formants.length)];
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(voice === 'frog' ? 0.5 : 0.28, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + sylDur);
      for (const ff of [f1, f2]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = ff;
        bp.Q.value = 6;
        o.connect(bp).connect(env);
      }
      env.connect(this.sfx);
      o.start(t);
      o.stop(t + sylDur + 0.02);
    }
  }

  // ---------- music ----------

  startMusic() {
    this.musicWanted = true;
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 50);
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextNoteTime < ctx.currentTime - 0.5) this.nextNoteTime = ctx.currentTime + 0.05;
    const stepDur = (60 / (118 * this.tempo)) / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextNoteTime - ctx.currentTime);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, when: number) {
    // C major bouncy tune: I - vi - IV - V
    const chords = [
      [48, 52, 55],
      [45, 48, 52],
      [41, 45, 48],
      [43, 47, 50],
    ];
    const melody = [
      72, -1, 76, 79, 76, -1, 74, 72, 74, -1, 72, 69, 67, -1, -1, -1,
      69, -1, 72, 76, 74, -1, 72, 69, 72, -1, 74, 72, 69, -1, -1, -1,
      65, -1, 69, 72, 74, -1, 72, 69, 67, -1, 69, 72, 74, -1, -1, -1,
      67, -1, 71, 74, 79, -1, 77, 74, 76, -1, 74, 71, 72, -1, -1, -1,
    ];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    const chord = chords[Math.floor(s / 16) % 4];
    if (s % 4 === 0) this.tone('triangle', midi(chord[0] - 12), midi(chord[0] - 12), 0.28, 0.5, when, this.music);
    if (s % 4 === 2) this.tone('triangle', midi(chord[0]), midi(chord[0]), 0.12, 0.25, when, this.music);
    if (s % 2 === 1) {
      for (const n of chord) this.tone('square', midi(n + 12), midi(n + 12), 0.05, 0.035, when, this.music);
    }
    const m = melody[s];
    if (m > 0) this.tone('square', midi(m), midi(m), 0.16, 0.09, when, this.music, 0.01);
    if (s % 8 === 4) {
      // soft clap
      const t = this.ctx!.currentTime + when;
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx!.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2500;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f).connect(g).connect(this.music);
      src.start(t);
      src.stop(t + 0.08);
    }
  }
}

export const Sound = new AudioManager();
