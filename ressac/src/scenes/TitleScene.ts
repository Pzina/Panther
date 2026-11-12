import { app } from '../app';
import { Backdrop } from '../art/backdrop';
import { drawBoatSide, drawGull } from '../art/props';
import { getBoat, getCosmetic } from '../data/equipment';
import type Phaser from 'phaser';
import { BaseScene } from './BaseScene';

/** Animated background of the home page: the sea, the rocking boat, a sky following the device clock. */
export class TitleScene extends BaseScene {
  private backdrop!: Backdrop;
  private boat!: Phaser.GameObjects.Graphics;
  private gulls!: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor() {
    super('Title');
  }

  protected build(): void {
    this.t = 0;
    this.backdrop = new Backdrop(this, {
      zone: 'anse',
      horizon: 0.5,
      hour: () => {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
      },
      weather: () => 'sun',
      reducedMotion: () => app.game.state.settings.reducedMotion,
    });
    this.boat = this.add.graphics().setDepth(20);
    this.gulls = this.add.graphics().setDepth(21);
    const state = app.game.state;
    drawBoatSide(this.boat, getCosmetic(state.cosmetics.boatColor), getBoat(state.equipment.boat).tier, 1.05);
    app.audio.setScene({ zone: 'anse', phase: 'day', weather: 'sun', calm: true });
  }

  protected layout(): void {
    this.backdrop.layout(this.W, this.H);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    this.backdrop.update(dt);
    const calm = app.game.state.settings.reducedMotion ? 0.3 : 1;
    const y = this.H * 0.62 + Math.sin(this.t * 1.1) * 4 * calm;
    this.boat.setPosition(this.W * 0.5 + Math.sin(this.t * 0.3) * 6 * calm, y);
    this.boat.setRotation(Math.sin(this.t * 0.9 + 0.6) * 0.06 * calm);
    this.gulls.clear();
    if (this.backdrop.darkness < 0.4) {
      for (let i = 0; i < 3; i++) {
        const x = ((this.t * (14 + i * 5) + i * 150) % (this.W + 80)) - 40;
        const gy = this.H * (0.16 + i * 0.07) + Math.sin(this.t * 0.7 + i) * 8;
        drawGull(this.gulls, x, gy, 9 - i, Math.sin(this.t * 6 + i * 2));
      }
    }
  }

  protected override teardown(): void {
    this.backdrop.destroy();
  }
}
