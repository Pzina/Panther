import type Phaser from 'phaser';
import { app } from '../app';
import { Backdrop } from '../art/backdrop';
import { mixNum } from '../art/color';
import { drawBoatSide, drawGull } from '../art/props';
import { getBoat, getCosmetic } from '../data/equipment';
import { BaseScene } from './BaseScene';

/** The port hub: a living backdrop behind the HTML buttons of the port HUD. */
export class PortScene extends BaseScene {
  private backdrop!: Backdrop;
  private village!: Phaser.GameObjects.Graphics;
  private quay!: Phaser.GameObjects.Graphics;
  private lamps!: Phaser.GameObjects.Graphics;
  private boat!: Phaser.GameObjects.Graphics;
  private extras!: Phaser.GameObjects.Graphics;
  private t = 0;
  private lastZoneWeather = '';

  constructor() {
    super('Port');
  }

  protected build(): void {
    const game = app.game;
    this.t = 0;
    this.backdrop = new Backdrop(this, {
      zone: 'anse',
      horizon: 0.34,
      hour: () => game.hour,
      weather: () => game.weather('anse'),
      reducedMotion: () => game.state.settings.reducedMotion,
      onThunder: () => app.audio.sfx('thunder'),
    });
    this.village = this.add.graphics().setDepth(7);
    this.extras = this.add.graphics().setDepth(9);
    this.quay = this.add.graphics().setDepth(12);
    this.boat = this.add.graphics().setDepth(20);
    this.lamps = this.add.graphics().setDepth(64);
    drawBoatSide(
      this.boat,
      getCosmetic(game.state.cosmetics.boatColor),
      getBoat(game.state.equipment.boat).tier,
      0.95,
    );
    this.syncSound();
  }

  private syncSound(): void {
    const game = app.game;
    const key = `${game.phase('anse')}-${game.weather('anse')}`;
    if (key === this.lastZoneWeather) return;
    this.lastZoneWeather = key;
    app.audio.setScene({ zone: 'anse', phase: game.phase('anse'), weather: game.weather('anse') });
    app.ui.root.classList.toggle('night', game.phase('anse') === 'night');
  }

  /** Redraws the boat after a purchase (called by the UI when the shop closes). */
  refreshBoat(): void {
    const state = app.game.state;
    drawBoatSide(this.boat, getCosmetic(state.cosmetics.boatColor), getBoat(state.equipment.boat).tier, 0.95);
  }

  protected layout(): void {
    const { W, H } = this;
    this.backdrop.layout(W, H);
    const hy = this.backdrop.horizonY;
    const v = this.village;
    v.clear();
    // Headland with the cabin, on the right.
    v.fillStyle(0x6f9a66, 1);
    v.beginPath();
    v.moveTo(W + 10, hy + 70);
    v.lineTo(196, hy + 70);
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      v.lineTo(196 + (W + 10 - 196) * t, hy + 70 - Math.sin(t * Math.PI * 0.62) * 150);
    }
    v.closePath();
    v.fillPath();
    v.fillStyle(0x8fae7a, 1);
    v.fillEllipse(330, hy - 30, 150, 60);
    // Cabin.
    const cx = 300;
    const cy = hy - 62;
    v.fillStyle(0xf6ecd2, 1);
    v.fillRect(cx - 34, cy, 68, 44);
    v.fillStyle(0xc94a3a, 1);
    v.fillTriangle(cx - 44, cy + 2, cx + 44, cy + 2, cx, cy - 34);
    v.fillStyle(0x7a4a2c, 1);
    v.fillRect(cx - 8, cy + 18, 16, 26);
    v.fillRect(cx + 20, cy - 36, 9, 22);
    v.fillStyle(0x8fd0e8, 1);
    v.fillRect(cx - 28, cy + 10, 14, 12);
    v.fillRect(cx + 14, cy + 10, 14, 12);
    v.lineStyle(2, 0x1d3344, 1);
    v.strokeRect(cx - 34, cy, 68, 44);
    v.strokeTriangle(cx - 44, cy + 2, cx + 44, cy + 2, cx, cy - 34);
    // Path down to the quay.
    v.lineStyle(7, 0xe6d8b0, 1);
    v.beginPath();
    v.moveTo(cx, cy + 46);
    v.lineTo(cx - 26, hy + 30);
    v.lineTo(cx - 10, hy + 70);
    v.strokePath();

    // Quay and its buildings.
    const q = this.quay;
    const top = H * 0.535;
    const front = H * 0.625;
    q.clear();
    // Posts.
    q.fillStyle(0x5a4028, 1);
    for (let x = 18; x < W; x += 58) q.fillRect(x, front - 4, 9, H * 0.09);
    q.fillStyle(0xb08452, 1);
    q.fillRect(0, top, W, front - top);
    q.lineStyle(1.5, 0x8a6238, 1);
    for (let y = top + 8; y < front; y += 10) q.lineBetween(0, y, W, y);
    q.fillStyle(0x8a6238, 1);
    q.fillRect(0, front - 5, W, 7);
    q.lineStyle(2, 0x1d3344, 1);
    q.lineBetween(0, top, W, top);

    // Jo's stall (left).
    const sx = 76;
    q.fillStyle(0x8a6238, 1);
    q.fillRect(sx - 52, top - 66, 6, 70);
    q.fillRect(sx + 46, top - 66, 6, 70);
    q.fillStyle(0xf6ecd2, 1);
    q.fillRect(sx - 50, top - 24, 100, 28);
    q.lineStyle(2, 0x1d3344, 1);
    q.strokeRect(sx - 50, top - 24, 100, 28);
    for (let i = 0; i < 6; i++) {
      q.fillStyle(i % 2 === 0 ? 0xc94a3a : 0xf6ecd2, 1);
      q.fillRect(sx - 60 + i * 20, top - 84, 20, 22);
      q.fillTriangle(sx - 60 + i * 20, top - 62, sx - 40 + i * 20, top - 62, sx - 50 + i * 20, top - 54);
    }
    q.strokeRect(sx - 60, top - 84, 120, 22);
    // Fish on display and crates.
    q.fillStyle(0x7fb0c4, 1);
    q.fillEllipse(sx - 26, top - 30, 22, 8);
    q.fillEllipse(sx + 2, top - 30, 22, 8);
    q.fillStyle(0xe8a82e, 1);
    q.fillEllipse(sx + 28, top - 30, 20, 8);
    q.fillStyle(0x9a7242, 1);
    q.fillRect(sx + 56, top - 16, 24, 20);
    q.strokeRect(sx + 56, top - 16, 24, 20);

    // Mission board (centre).
    const bx = W * 0.5;
    q.fillStyle(0x7a4a2c, 1);
    q.fillRect(bx - 28, top - 58, 5, 62);
    q.fillRect(bx + 23, top - 58, 5, 62);
    q.fillStyle(0x9a6a3c, 1);
    q.fillRect(bx - 34, top - 76, 68, 46);
    q.strokeRect(bx - 34, top - 76, 68, 46);
    q.fillStyle(0xfbf5e6, 1);
    q.fillRect(bx - 28, top - 70, 22, 26);
    q.fillRect(bx + 2, top - 68, 24, 18);
    q.fillStyle(0xf3d27a, 1);
    q.fillRect(bx + 4, top - 46, 18, 12);
    q.fillStyle(0xc94a3a, 1);
    q.fillCircle(bx - 17, top - 68, 2.5);
    q.fillCircle(bx + 14, top - 66, 2.5);

    // Nell's map table (right).
    const mx = W - 78;
    q.fillStyle(0x7a4a2c, 1);
    q.fillRect(mx - 34, top - 22, 5, 26);
    q.fillRect(mx + 29, top - 22, 5, 26);
    q.fillStyle(0xb08452, 1);
    q.fillRect(mx - 40, top - 30, 80, 10);
    q.strokeRect(mx - 40, top - 30, 80, 10);
    q.fillStyle(0xf6ecd2, 1);
    q.fillRect(mx - 30, top - 38, 50, 9);
    q.fillStyle(0x3fb0c6, 1);
    q.fillRect(mx - 26, top - 37, 16, 7);
    // Flag.
    q.lineStyle(3, 0x7a4a2c, 1);
    q.lineBetween(mx + 34, top - 30, mx + 34, top - 86);
    q.fillStyle(0xe8a82e, 1);
    q.fillTriangle(mx + 34, top - 86, mx + 34, top - 68, mx + 62, top - 77);
    // Bollards.
    q.fillStyle(0x1d3344, 1);
    for (const x of [40, 190, 340]) {
      q.fillRect(x - 4, front - 16, 8, 12);
      q.fillCircle(x, front - 16, 6);
    }
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const game = app.game;
    this.t += dt;
    game.advance(dt);
    this.backdrop.update(dt);
    this.syncSound();
    const calm = game.state.settings.reducedMotion ? 0.3 : 1;
    const { W, H } = this;

    this.boat.setPosition(
      W * 0.5 + Math.sin(this.t * 0.4) * 3 * calm,
      H * 0.775 + Math.sin(this.t * 1.2) * 3 * calm,
    );
    this.boat.setRotation(Math.sin(this.t * 1.0 + 1) * 0.04 * calm);

    const e = this.extras;
    e.clear();
    const hy = this.backdrop.horizonY;
    // Small boats at anchor in the bay.
    const small = (x: number, y: number, color: number, phase: number): void => {
      const bob = Math.sin(this.t * 1.3 + phase) * 2 * calm;
      e.fillStyle(color, 1);
      e.fillTriangle(x - 20, y + bob - 6, x + 22, y + bob - 6, x + 14, y + bob + 4);
      e.fillTriangle(x - 20, y + bob - 6, x - 13, y + bob + 4, x + 14, y + bob + 4);
      e.lineStyle(2, 0x7a4a2c, 1);
      e.lineBetween(x, y + bob - 6, x, y + bob - 28);
      e.fillStyle(0xfbf5e6, 1);
      e.fillTriangle(x + 2, y + bob - 26, x + 2, y + bob - 10, x + 16, y + bob - 10);
    };
    small(70, hy + 44, 0x2f6f9f, 0);
    small(150, hy + 72, 0xe8b830, 2);
    // Chimney smoke.
    for (let i = 0; i < 4; i++) {
      const life = (this.t * 0.35 + i * 0.25) % 1;
      e.fillStyle(0xffffff, 0.5 * (1 - life));
      e.fillCircle(325 + Math.sin(life * 5 + i) * 5 + life * 14, hy - 100 - life * 46, 4 + life * 7);
    }
    // Gulls by day.
    if (this.backdrop.darkness < 0.4) {
      for (let i = 0; i < 3; i++) {
        const x = ((this.t * (16 + i * 6) + i * 130) % (W + 80)) - 40;
        const y = H * (0.08 + i * 0.05) + Math.sin(this.t * 0.8 + i * 2) * 7;
        drawGull(e, x, y, 8 - i, Math.sin(this.t * 6 + i * 2), 0xffffff);
      }
    }

    // Warm lights when it gets dark.
    const l = this.lamps;
    l.clear();
    const dark = this.backdrop.darkness;
    if (dark > 0.2) {
      const a = Math.min(1, (dark - 0.2) * 2.4);
      const lamp = (x: number, y: number, r: number): void => {
        l.fillStyle(0xffd27a, 0.16 * a);
        l.fillCircle(x, y, r * 2.6);
        l.fillStyle(0xffe2a0, 0.85 * a);
        l.fillCircle(x, y, r);
      };
      lamp(279, hy - 46, 5);
      lamp(321, hy - 46, 5);
      lamp(76, H * 0.535 - 50, 5);
      lamp(W - 44, H * 0.535 - 48, 4);
      // Lighthouse beam.
      const beam = (Math.sin(this.t * 0.8) + 1) / 2;
      l.fillStyle(mixNum(0xffe2a0, 0xffffff, 0.3), (0.25 + 0.55 * beam) * a);
      l.fillCircle(57, hy - 86, 5 + beam * 3);
    }
  }

  protected override teardown(): void {
    this.backdrop.destroy();
  }
}
