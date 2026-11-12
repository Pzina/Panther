import type { DayPhase, Weather, ZoneId } from '../data/types';
import { getZone } from '../data/zones';

export type SfxName =
  | 'click'
  | 'cast'
  | 'splash'
  | 'nibble'
  | 'bite'
  | 'reel'
  | 'snap'
  | 'escape'
  | 'catch'
  | 'rare'
  | 'coins'
  | 'page'
  | 'error'
  | 'levelup'
  | 'thunder'
  | 'release'
  | 'jump'
  | 'whoosh';

export interface SoundScene {
  zone: ZoneId;
  phase: DayPhase;
  weather: Weather;
  /** Title screen: music only, light sea ambience. */
  calm?: boolean;
}

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Everything you hear is synthesised here with the Web Audio API: sound effects, a generative
 * ambient music and environmental ambience. No audio file is loaded.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private delay!: DelayNode;
  private noise!: AudioBuffer;
  private volumes = { music: 0.6, sfx: 0.8, ambience: 0.5 };
  private scene: SoundScene | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private chordIndex = 0;
  private seed = 1;
  private amb: {
    sea: GainNode;
    seaFilter: BiquadFilterNode;
    wind: GainNode;
    rain: GainNode;
    drone: GainNode;
  } | null = null;
  private nextCritter = 0;
  private tension: { osc: OscillatorNode; gain: GainNode } | null = null;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    this.master.connect(limiter).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    for (const bus of [this.musicBus, this.sfxBus, this.ambBus]) bus.connect(this.master);
    // Soft echo for the melody.
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    this.delay.connect(damp).connect(feedback).connect(this.delay);
    damp.connect(this.musicBus);

    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this.buildAmbience();
    this.applyVolumes();
    this.seed = (Date.now() & 0xffff) + 1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  private noiseSource(loop = true): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  private buildAmbience(): void {
    const ctx = this.ctx!;
    const make = (
      type: BiquadFilterType,
      freq: number,
      q = 0.7,
    ): { gain: GainNode; filter: BiquadFilterNode } => {
      const src = this.noiseSource();
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.ambBus);
      src.start();
      return { gain, filter };
    };
    const sea = make('lowpass', 520);
    // Slow swell on the sea noise.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(sea.filter.frequency);
    lfo.start();
    const wind = make('bandpass', 620, 1.4);
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 240;
    windLfo.connect(windLfoGain).connect(wind.filter.frequency);
    windLfo.start();
    const rain = make('highpass', 3200);
    // Deep drone for the Fosse.
    const drone = ctx.createGain();
    drone.gain.value = 0;
    for (const f of [55, 55.6, 82.4]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(drone);
      osc.start();
    }
    drone.connect(this.ambBus);
    this.amb = { sea: sea.gain, seaFilter: sea.filter, wind: wind.gain, rain: rain.gain, drone };
  }

  setVolumes(v: { music: number; sfx: number; ambience: number }): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.9, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.ambience * 0.7, t, 0.2);
  }

  /** Pauses / resumes all sound (app in background, pause menu keeps it running). */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended && this.ctx.state === 'running') void this.ctx.suspend();
    else if (!suspended && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setScene(scene: SoundScene): void {
    this.scene = scene;
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const zone = getZone(scene.zone);
    const fosse = zone.permanentNight;
    const sea = zone.freshwater ? (scene.zone === 'riviere' ? 0.5 : 0.1) : fosse ? 0.18 : 0.42;
    const stormy = scene.weather === 'storm';
    const rainy = scene.weather === 'rain' || stormy;
    this.amb.sea.gain.setTargetAtTime((scene.calm ? 0.3 : sea) * (stormy ? 1.5 : 1), t, 1.2);
    this.amb.seaFilter.frequency.setTargetAtTime(scene.zone === 'riviere' ? 1500 : 520, t, 1);
    this.amb.wind.gain.setTargetAtTime(stormy ? 0.34 : rainy || scene.zone === 'large' ? 0.14 : 0.04, t, 1.5);
    this.amb.rain.gain.setTargetAtTime(stormy ? 0.2 : rainy ? 0.11 : 0, t, 1.5);
    this.amb.drone.gain.setTargetAtTime(fosse ? 0.1 : 0, t, 2);
  }

  // ───────────────────────── Generative music ─────────────────────────

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.scene) return;
    const zone = getZone(this.scene.zone);
    const night = this.scene.phase === 'night';
    const tempo = zone.music.tempo * (night ? 0.8 : this.scene.phase === 'day' ? 1.05 : 0.92);
    const step = 0.5 / tempo;
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.35) {
      this.playBeat(this.nextBeat, step, zone.music.root + (night ? -5 : 0), zone.music.scale);
      this.nextBeat += step;
      this.beat += 1;
    }
    this.scheduleCritters(ctx.currentTime);
  }

  private playBeat(time: number, step: number, root: number, scale: number[]): void {
    const scene = this.scene!;
    const degree = (i: number): number => {
      const octave = Math.floor(i / scale.length);
      return root + scale[((i % scale.length) + scale.length) % scale.length]! + 12 * octave;
    };
    // A new chord every 8 steps.
    if (this.beat % 8 === 0) {
      const progression = [0, 3, 1, 4, 0, 2, 3, 1];
      this.chordIndex = progression[Math.floor(this.beat / 8) % progression.length]!;
      const length = step * 8;
      for (const offset of [0, 2, 4]) {
        this.pad(midiToHz(degree(this.chordIndex + offset) - 12), time, length);
      }
      this.pluck(midiToHz(degree(this.chordIndex) - 24), time, length * 0.9, 0.11, 'sine', false);
    }
    const density = scene.phase === 'night' ? 0.22 : scene.phase === 'day' ? 0.42 : 0.32;
    if (this.rand() < density * (scene.weather === 'storm' ? 0.6 : 1)) {
      const note = degree(this.chordIndex + Math.floor(this.rand() * 7) + 2);
      this.pluck(midiToHz(note), time, step * 3, 0.08 + this.rand() * 0.05, 'triangle', true);
    }
  }

  private pad(freq: number, time: number, length: number): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + length * 0.35);
    gain.gain.linearRampToValueAtTime(0, time + length * 1.25);
    for (const detune of [-6, 5]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + length * 1.3);
    }
    filter.connect(gain).connect(this.musicBus);
  }

  private pluck(
    freq: number,
    time: number,
    length: number,
    level: number,
    type: OscillatorType,
    echo: boolean,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + length);
    osc.connect(gain);
    gain.connect(this.musicBus);
    if (echo) gain.connect(this.delay);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  // ───────────────────────── Ambience events ─────────────────────────

  private scheduleCritters(now: number): void {
    const scene = this.scene!;
    if (now < this.nextCritter) return;
    const zone = getZone(scene.zone);
    this.nextCritter = now + 5 + this.rand() * 9;
    if (zone.permanentNight) {
      this.drip(now + 0.1);
    } else if (scene.phase === 'night' || (zone.freshwater && scene.phase !== 'day')) {
      this.crickets(now + 0.1);
    } else if (!zone.freshwater && scene.weather !== 'storm') {
      this.gull(now + 0.1);
    } else if (zone.freshwater) {
      this.birdsong(now + 0.1);
    }
  }

  private chirp(
    time: number,
    from: number,
    to: number,
    length: number,
    level: number,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + length * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + length);
    osc.connect(gain).connect(this.ambBus);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  private gull(time: number): void {
    const calls = 2 + Math.floor(this.rand() * 3);
    for (let i = 0; i < calls; i++) {
      const t = time + i * 0.32;
      this.chirp(t, 1500 + this.rand() * 300, 900, 0.26, 0.05, 'sawtooth');
    }
  }

  private crickets(time: number): void {
    const bursts = 6 + Math.floor(this.rand() * 6);
    for (let i = 0; i < bursts; i++) {
      this.chirp(time + i * 0.085, 4300, 4100, 0.05, 0.022, 'square');
    }
  }

  private birdsong(time: number): void {
    for (let i = 0; i < 3; i++) {
      this.chirp(time + i * 0.16, 2200 + this.rand() * 900, 2900 + this.rand() * 600, 0.1, 0.03);
    }
  }

  private drip(time: number): void {
    this.chirp(time, 900 + this.rand() * 500, 420, 0.5, 0.05);
  }

  // ───────────────────────── Sound effects ─────────────────────────

  private tone(
    freq: number,
    length: number,
    level: number,
    type: OscillatorType = 'sine',
    delay = 0,
    slideTo?: number,
  ): void {
    const ctx = this.ctx!;
    const time = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, time + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + Math.min(0.012, length * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, time + length);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + length + 0.03);
  }

  private burst(
    length: number,
    level: number,
    type: BiquadFilterType,
    freq: number,
    delay = 0,
    sweepTo?: number,
    q = 0.8,
  ): void {
    const ctx = this.ctx!;
    const time = ctx.currentTime + delay;
    const src = this.noiseSource(false);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, time);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, time + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + Math.min(0.02, length * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, time + length);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(time, Math.random() * 1.2);
    src.stop(time + length + 0.05);
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'click':
        this.tone(660, 0.06, 0.12, 'triangle');
        break;
      case 'whoosh':
        this.burst(0.35, 0.16, 'bandpass', 500, 0, 1800, 1.2);
        break;
      case 'cast':
        this.burst(0.42, 0.22, 'bandpass', 700, 0, 2600, 2);
        this.tone(520, 0.3, 0.05, 'sine', 0, 1100);
        break;
      case 'splash':
        this.burst(0.5, 0.3, 'lowpass', 2400, 0, 400);
        this.tone(320, 0.18, 0.12, 'sine', 0, 110);
        break;
      case 'nibble':
        this.tone(480, 0.07, 0.08, 'sine', 0, 380);
        break;
      case 'bite':
        this.tone(880, 0.09, 0.2, 'square');
        this.tone(1320, 0.14, 0.2, 'square', 0.09);
        this.burst(0.2, 0.14, 'lowpass', 1600, 0, 500);
        break;
      case 'reel':
        this.burst(0.03, 0.12, 'highpass', 2600);
        this.tone(1500 + Math.random() * 300, 0.025, 0.04, 'square');
        break;
      case 'snap':
        this.burst(0.09, 0.4, 'highpass', 1800);
        this.tone(900, 0.3, 0.2, 'sawtooth', 0, 90);
        break;
      case 'escape':
        this.tone(440, 0.28, 0.14, 'triangle', 0, 190);
        this.burst(0.3, 0.12, 'lowpass', 1200, 0.05, 300);
        break;
      case 'jump':
        this.burst(0.4, 0.22, 'bandpass', 900, 0, 3000, 1);
        break;
      case 'catch':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, 0.14, 'triangle', i * 0.08));
        this.burst(0.4, 0.14, 'lowpass', 2600, 0, 500);
        break;
      case 'rare':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
          this.tone(f, 0.5, 0.12, 'triangle', i * 0.09);
          this.tone(f * 2, 0.4, 0.04, 'sine', i * 0.09 + 0.04);
        });
        break;
      case 'coins':
        [1568, 2093, 1760, 2349].forEach((f, i) => this.tone(f, 0.11, 0.09, 'square', i * 0.055));
        break;
      case 'page':
        this.burst(0.28, 0.16, 'bandpass', 2400, 0, 900, 0.7);
        break;
      case 'error':
        this.tone(220, 0.16, 0.14, 'square');
        this.tone(175, 0.22, 0.14, 'square', 0.12);
        break;
      case 'levelup':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.34, 0.13, 'triangle', i * 0.1));
        break;
      case 'thunder':
        this.burst(1.8, 0.5, 'lowpass', 300, 0, 60);
        this.burst(0.3, 0.3, 'lowpass', 1200, 0, 200);
        break;
      case 'release':
        this.burst(0.35, 0.18, 'lowpass', 1500, 0, 500);
        this.tone(660, 0.2, 0.08, 'sine', 0.05, 990);
        break;
    }
  }

  /** Continuous "taut line" tone: `level` 0 (silent) .. 1 (about to snap). */
  setTension(level: number): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    if (!this.tension) {
      if (level <= 0) return;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.sfxBus);
      osc.start();
      this.tension = { osc, gain };
    }
    const t = ctx.currentTime;
    const clamped = Math.min(1, Math.max(0, level));
    this.tension.osc.frequency.setTargetAtTime(500 + clamped * 900, t, 0.05);
    this.tension.gain.gain.setTargetAtTime(clamped * clamped * 0.1, t, 0.05);
    if (level <= 0) {
      const dead = this.tension;
      this.tension = null;
      dead.gain.gain.setTargetAtTime(0, t, 0.03);
      dead.osc.stop(t + 0.3);
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
