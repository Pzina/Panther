import Phaser from 'phaser';
import { hashSeed, Rng } from '../core/rng';
import type { Weather, ZoneId } from '../data/types';
import { getZone } from '../data/zones';
import { mixNum } from './color';

export interface BackdropConfig {
  zone: ZoneId;
  /** Horizon position as a fraction of the screen height. */
  horizon: number;
  hour: () => number;
  weather: () => Weather;
  reducedMotion: () => boolean;
  onThunder?: () => void;
}

interface SkyKey {
  h: number;
  top: number;
  bottom: number;
}

const SKY: SkyKey[] = [
  { h: 0, top: 0x0b1030, bottom: 0x1c2850 },
  { h: 5, top: 0x0b1030, bottom: 0x1c2850 },
  { h: 6.5, top: 0x5a6fa8, bottom: 0xf4a77a },
  { h: 8.5, top: 0x4f9fe0, bottom: 0xcfeaf5 },
  { h: 17, top: 0x4f9fe0, bottom: 0xcfeaf5 },
  { h: 19, top: 0x5a4a8a, bottom: 0xf08a5a },
  { h: 20.5, top: 0x1a1c48, bottom: 0x3a3560 },
  { h: 21.5, top: 0x0b1030, bottom: 0x1c2850 },
  { h: 24, top: 0x0b1030, bottom: 0x1c2850 },
];

export function skyColors(hour: number, weather: Weather): { top: number; bottom: number } {
  let a = SKY[0]!;
  let b = SKY[SKY.length - 1]!;
  for (let i = 0; i < SKY.length - 1; i++) {
    if (hour >= SKY[i]!.h && hour <= SKY[i + 1]!.h) {
      a = SKY[i]!;
      b = SKY[i + 1]!;
      break;
    }
  }
  const t = b.h > a.h ? (hour - a.h) / (b.h - a.h) : 0;
  let top = mixNum(a.top, b.top, t);
  let bottom = mixNum(a.bottom, b.bottom, t);
  const grey = weather === 'storm' ? 0x4a5562 : weather === 'fog' ? 0xc2ccd2 : 0x8a98a6;
  const amount = weather === 'storm' ? 0.7 : weather === 'rain' ? 0.55 : weather === 'fog' ? 0.5 : weather === 'clouds' ? 0.3 : 0;
  if (amount > 0) {
    const dark = nightness(hour);
    const g = mixNum(grey, 0x101828, dark * 0.75);
    top = mixNum(top, g, amount);
    bottom = mixNum(bottom, g, amount * 0.8);
  }
  return { top, bottom };
}

/** 0 in full daylight, 1 in the middle of the night. */
export function nightness(hour: number): number {
  if (hour < 5 || hour >= 21) return 1;
  if (hour < 7) return 1 - (hour - 5) / 2;
  if (hour >= 19) return (hour - 19) / 2;
  return 0;
}

/** Sky, sun and moon, clouds, distant land, animated water and weather effects of a zone. */
export class Backdrop {
  horizonY = 0;
  darkness = 0;
  private W = 390;
  private H = 844;
  private sky: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics;
  private celestial: Phaser.GameObjects.Graphics;
  private cloudLayer: Phaser.GameObjects.Graphics;
  private land: Phaser.GameObjects.Graphics;
  private water: Phaser.GameObjects.Graphics;
  private waves: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private weatherFx: Phaser.GameObjects.Graphics;
  private clouds: { x: number; y: number; s: number; v: number }[] = [];
  private starList: { x: number; y: number; r: number; p: number }[] = [];
  private drops: { x: number; y: number; v: number }[] = [];
  private glints: { x: number; y: number; p: number }[] = [];
  private flash = 0;
  private nextFlash = 4;
  private skyTimer = 0;
  private time = 0;
  private lastWeather: Weather | null = null;

  constructor(
    scene: Phaser.Scene,
    private cfg: BackdropConfig,
  ) {
    const g = (depth: number): Phaser.GameObjects.Graphics => scene.add.graphics().setDepth(depth);
    this.sky = g(0);
    this.stars = g(1);
    this.celestial = g(2);
    this.cloudLayer = g(3);
    this.land = g(4);
    this.water = g(5);
    this.waves = g(6);
    this.overlay = g(60);
    this.weatherFx = g(62);
  }

  layout(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.horizonY = Math.round(H * this.cfg.horizon);
    const rng = new Rng(hashSeed('backdrop', this.cfg.zone));
    this.clouds = Array.from({ length: 7 }, () => ({
      x: rng.range(-40, W + 40),
      y: rng.range(H * 0.03, this.horizonY * 0.75),
      s: rng.range(0.6, 1.3),
      v: rng.range(2, 6),
    }));
    this.starList = Array.from({ length: 46 }, () => ({
      x: rng.range(0, W),
      y: rng.range(0, this.horizonY * 0.95),
      r: rng.range(0.5, 1.5),
      p: rng.range(0, 6.28),
    }));
    this.drops = Array.from({ length: 70 }, () => ({ x: rng.range(-40, W), y: rng.range(0, H), v: rng.range(520, 760) }));
    this.glints = Array.from({ length: 16 }, () => ({
      x: rng.range(10, W - 10),
      y: rng.range(this.horizonY + 14, H - 40),
      p: rng.range(0, 6.28),
    }));
    this.drawLand();
    this.skyTimer = 0;
  }

  private palette(): { top: number; bottom: number } {
    const zone = getZone(this.cfg.zone);
    const weather = this.cfg.weather();
    let top = zone.palette.waterTop;
    let bottom = zone.palette.waterBottom;
    if (weather === 'glow') {
      top = mixNum(top, 0x2ad0e0, 0.35);
      bottom = mixNum(bottom, 0x0a3a6a, 0.3);
    } else if (weather === 'storm' || weather === 'rain') {
      top = mixNum(top, 0x55636e, weather === 'storm' ? 0.55 : 0.3);
      bottom = mixNum(bottom, 0x1c2630, weather === 'storm' ? 0.5 : 0.25);
    } else if (weather === 'fog') {
      top = mixNum(top, 0xb8c4c8, 0.4);
    }
    return { top, bottom };
  }

  private drawSky(): void {
    const zone = getZone(this.cfg.zone);
    const hour = zone.permanentNight ? 0 : this.cfg.hour();
    const weather = this.cfg.weather();
    const { top, bottom } = skyColors(hour, weather);
    const { W, H, horizonY } = this;
    this.sky.clear();
    this.sky.fillGradientStyle(top, top, bottom, bottom, 1);
    this.sky.fillRect(0, 0, W, horizonY + 2);

    this.darkness = Math.min(0.72, nightness(hour) * 0.58 + (weather === 'storm' ? 0.16 : 0) + (zone.permanentNight ? 0.14 : 0));

    // Sun or moon.
    const c = this.celestial;
    c.clear();
    const clear = weather === 'sun' || weather === 'clouds' || weather === 'glow';
    if (!zone.permanentNight && clear) {
      const day = hour >= 6 && hour < 20;
      const t = day ? (hour - 6) / 14 : ((hour + 24 - 20) % 24) / 10;
      const x = W * (0.08 + 0.84 * t);
      const y = horizonY - Math.sin(Math.PI * t) * horizonY * 0.78 + 6;
      if (day) {
        const low = 1 - Math.sin(Math.PI * t);
        const color = mixNum(0xfff6c8, 0xffa25a, low);
        c.fillStyle(color, 0.22);
        c.fillCircle(x, y, 34);
        c.fillStyle(color, 1);
        c.fillCircle(x, y, 19);
      } else {
        c.fillStyle(0xf6ecd2, 0.16);
        c.fillCircle(x, y, 30);
        c.fillStyle(0xf6ecd2, 1);
        c.fillCircle(x, y, 15);
        c.fillStyle(top, 1);
        c.fillCircle(x + 7, y - 4, 13);
      }
    }

    // Water body.
    const p = this.palette();
    this.water.clear();
    this.water.fillGradientStyle(p.top, p.top, p.bottom, p.bottom, 1);
    this.water.fillRect(0, horizonY, W, H - horizonY);
    // Soft band of sky colour at the horizon.
    this.water.fillStyle(bottom, 0.28);
    this.water.fillRect(0, horizonY, W, 10);

    this.overlay.clear();
    if (this.darkness > 0.01) {
      this.overlay.fillStyle(0x070b24, this.darkness);
      this.overlay.fillRect(0, 0, W, H);
    }
    if (weather === 'fog') {
      this.overlay.fillStyle(0xdfe6e8, 0.2);
      this.overlay.fillRect(0, 0, W, H);
    }
  }

  private tree(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number): void {
    g.fillStyle(color, 1);
    g.fillCircle(x, y - 14 * s, 13 * s);
    g.fillCircle(x - 10 * s, y - 7 * s, 10 * s);
    g.fillCircle(x + 10 * s, y - 7 * s, 10 * s);
    g.fillRect(x - 12 * s, y - 8 * s, 24 * s, 9 * s);
  }

  private drawLand(): void {
    const g = this.land;
    const { W, horizonY: y } = this;
    const zone = getZone(this.cfg.zone);
    const { land, landDark } = zone.palette;
    const rng = new Rng(hashSeed('land', zone.id));
    g.clear();
    const hill = (x0: number, x1: number, height: number, color: number, skew = 0.5): void => {
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(x0, y + 1);
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const shape = Math.pow(Math.sin(Math.PI * Math.pow(t, skew * 2)), 0.9);
        g.lineTo(x0 + (x1 - x0) * t, y + 1 - shape * height);
      }
      g.lineTo(x1, y + 1);
      g.closePath();
      g.fillPath();
    };
    switch (zone.id) {
      case 'anse': {
        hill(-30, 150, 58, landDark, 0.42);
        hill(-60, 96, 40, land, 0.5);
        hill(250, W + 60, 46, landDark, 0.6);
        hill(290, W + 40, 30, land, 0.5);
        // Lighthouse.
        g.fillStyle(0xf6ecd2, 1);
        g.fillRect(52, y - 92, 10, 40);
        g.fillStyle(0xe2543e, 1);
        g.fillRect(52, y - 80, 10, 7);
        g.fillRect(52, y - 64, 10, 7);
        g.fillTriangle(49, y - 92, 65, y - 92, 57, y - 102);
        break;
      }
      case 'etang': {
        hill(-20, W + 20, 26, landDark, 0.5);
        for (let i = 0; i < 12; i++) {
          this.tree(g, rng.range(0, W), y - rng.range(2, 14), rng.range(1, 1.9), i % 2 === 0 ? landDark : land);
        }
        // Reeds on the banks.
        g.lineStyle(2, landDark, 1);
        for (let i = 0; i < 26; i++) {
          const x = i < 13 ? rng.range(0, 70) : rng.range(W - 70, W);
          g.lineBetween(x, y + 6, x + rng.range(-3, 3), y - rng.range(8, 20));
        }
        break;
      }
      case 'riviere': {
        hill(-40, 210, 96, 0x8a96a8, 0.5);
        hill(150, W + 60, 120, 0x76849a, 0.45);
        hill(-60, 140, 44, landDark, 0.5);
        hill(240, W + 60, 52, landDark, 0.55);
        g.fillStyle(land, 1);
        for (let i = 0; i < 16; i++) {
          const x = i < 8 ? rng.range(0, 120) : rng.range(260, W);
          const h = rng.range(16, 30);
          g.fillTriangle(x - 7, y - 2, x + 7, y - 2, x, y - 2 - h);
        }
        break;
      }
      case 'recif': {
        hill(30, 150, 16, land, 0.5);
        hill(250, 372, 20, land, 0.5);
        const palm = (x: number, h: number): void => {
          g.lineStyle(3, 0x8a6a4a, 1);
          g.lineBetween(x, y - 8, x + 5, y - 8 - h);
          g.fillStyle(0x3f9a6a, 1);
          for (const a of [-2.6, -2, -1.2, -0.5, 0.1]) {
            g.fillEllipse(x + 5 + Math.cos(a) * 11, y - 8 - h + Math.sin(a) * 5 + 3, 22, 7);
          }
        };
        palm(84, 30);
        palm(108, 22);
        palm(306, 34);
        break;
      }
      case 'large': {
        g.fillStyle(landDark, 1);
        g.fillTriangle(308, y + 1, 336, y + 1, 324, y - 12);
        // Buoy.
        g.fillStyle(0xe2543e, 1);
        g.fillRect(70, y - 8, 6, 9);
        g.fillStyle(0xf6ecd2, 1);
        g.fillTriangle(68, y - 8, 78, y - 8, 73, y - 16);
        break;
      }
      case 'fosse': {
        g.fillStyle(landDark, 1);
        const spike = (x: number, w: number, h: number): void => {
          g.fillTriangle(x, y + 1, x + w, y + 1, x + w * 0.45, y - h);
        };
        spike(-20, 90, 110);
        spike(40, 60, 64);
        spike(300, 110, 130);
        spike(270, 60, 70);
        g.fillStyle(land, 1);
        spike(-30, 60, 60);
        spike(340, 70, 80);
        break;
      }
    }
  }

  private drawClouds(dt: number): void {
    const g = this.cloudLayer;
    g.clear();
    const weather = this.cfg.weather();
    const zone = getZone(this.cfg.zone);
    if (zone.permanentNight) return;
    const count = weather === 'sun' ? 2 : weather === 'glow' ? 1 : weather === 'clouds' ? 5 : 7;
    const hour = this.cfg.hour();
    const dark = nightness(hour);
    const base = weather === 'storm' ? 0x59636e : weather === 'rain' ? 0x9aa6b0 : 0xffffff;
    const color = mixNum(base, 0x2a3350, dark * 0.7);
    const alpha = weather === 'sun' ? 0.85 : 0.92;
    for (let i = 0; i < count; i++) {
      const c = this.clouds[i]!;
      c.x += c.v * dt * (weather === 'storm' ? 3 : 1);
      if (c.x > this.W + 70) c.x = -70;
      g.fillStyle(color, alpha);
      g.fillEllipse(c.x, c.y, 62 * c.s, 18 * c.s);
      g.fillEllipse(c.x - 16 * c.s, c.y - 7 * c.s, 34 * c.s, 18 * c.s);
      g.fillEllipse(c.x + 12 * c.s, c.y - 10 * c.s, 40 * c.s, 22 * c.s);
    }
  }

  private drawStars(): void {
    const g = this.stars;
    g.clear();
    const zone = getZone(this.cfg.zone);
    const dark = zone.permanentNight ? 1 : nightness(this.cfg.hour());
    const weather = this.cfg.weather();
    if (dark < 0.3 || weather === 'storm' || weather === 'rain' || weather === 'fog') return;
    for (const s of this.starList) {
      const tw = 0.55 + 0.45 * Math.sin(this.time * 1.3 + s.p);
      g.fillStyle(0xffffff, (dark - 0.3) * 1.4 * tw);
      g.fillCircle(s.x, s.y, s.r);
    }
  }

  private drawWaves(): void {
    const g = this.waves;
    g.clear();
    const { W, H, horizonY } = this;
    const zone = getZone(this.cfg.zone);
    const weather = this.cfg.weather();
    const p = this.palette();
    const rough = (zone.gimmick === 'swell' ? 1.7 : zone.gimmick === 'still' ? 0.45 : 1) * (weather === 'storm' ? 1.8 : weather === 'rain' ? 1.2 : 1);
    const speed = this.cfg.reducedMotion() ? 0.25 : 1;
    const rows = 10;
    for (let i = 0; i < rows; i++) {
      const f = (i + 0.4) / rows;
      const y = horizonY + Math.pow(f, 1.5) * (H - horizonY);
      const amp = (0.8 + 4.2 * f) * rough;
      const k = (Math.PI * 2) / (46 + 110 * f);
      const phase = this.time * speed * (0.5 + f * 0.9) * (i % 2 === 0 ? 1 : -0.7) + i * 1.7;
      const drift = zone.gimmick === 'current' ? this.time * speed * 1.4 : 0;
      g.lineStyle(1.2 + f * 2.2, mixNum(p.top, 0xffffff, weather === 'glow' ? 0.5 : 0.32), 0.26 + 0.22 * (1 - f));
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 13) {
        const yy = y + Math.sin(x * k + phase - drift) * amp + Math.sin(x * k * 0.37 + phase * 0.6) * amp * 0.5;
        if (x === -10) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.strokePath();
    }
    // Sparkles: sun glints by day, bioluminescence during a glowing tide or in the Fosse.
    const glow = weather === 'glow' || zone.permanentNight;
    if (glow || (weather === 'sun' && this.darkness < 0.2)) {
      for (const s of this.glints) {
        const a = Math.max(0, Math.sin(this.time * (glow ? 0.9 : 1.6) + s.p));
        if (a < 0.2) continue;
        g.fillStyle(glow ? 0x7af4ea : 0xffffff, a * (glow ? 0.75 : 0.5));
        g.fillCircle(s.x, s.y, glow ? 1.8 : 1.3);
      }
    }
  }

  private drawWeather(dt: number): void {
    const g = this.weatherFx;
    g.clear();
    const weather = this.cfg.weather();
    const { W, H } = this;
    if (weather === 'rain' || weather === 'storm') {
      const slant = weather === 'storm' ? 0.34 : 0.16;
      g.lineStyle(1.2, 0xdfeaf2, weather === 'storm' ? 0.5 : 0.36);
      const count = weather === 'storm' ? this.drops.length : 40;
      for (let i = 0; i < count; i++) {
        const d = this.drops[i]!;
        d.y += d.v * dt;
        d.x += d.v * dt * slant;
        if (d.y > H) {
          d.y = -20;
          d.x = Math.random() * (W + 60) - 60;
        }
        g.lineBetween(d.x, d.y, d.x + 12 * slant, d.y + 12);
      }
    }
    if (weather === 'storm' && !this.cfg.reducedMotion()) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 5 + Math.random() * 9;
        this.flash = 0.5;
        this.cfg.onThunder?.();
      }
      if (this.flash > 0) {
        this.flash -= dt * 1.8;
        g.fillStyle(0xffffff, Math.max(0, this.flash) * 0.55);
        g.fillRect(0, 0, W, H);
      }
    }
    if (weather === 'fog') {
      for (let i = 0; i < 3; i++) {
        const x = ((this.time * (6 + i * 3) + i * 170) % (W + 300)) - 150;
        g.fillStyle(0xeef2f3, 0.2);
        g.fillEllipse(x, this.horizonY + 10 + i * 46, 330, 60);
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.skyTimer -= dt;
    const weather = this.cfg.weather();
    if (this.skyTimer <= 0 || weather !== this.lastWeather) {
      this.skyTimer = 1;
      this.lastWeather = weather;
      this.drawSky();
    }
    this.drawStars();
    this.drawClouds(dt);
    this.drawWaves();
    this.drawWeather(dt);
  }

  /** Screen y of a point on the water at a given distance (0 = near the boat, 1 = horizon). */
  waterY(distance: number, nearY: number): number {
    const far = this.horizonY + 26;
    return nearY + (far - nearY) * Math.pow(distance, 0.85);
  }

  destroy(): void {
    for (const g of [this.sky, this.stars, this.celestial, this.cloudLayer, this.land, this.water, this.waves, this.overlay, this.weatherFx]) {
      g.destroy();
    }
  }
}
