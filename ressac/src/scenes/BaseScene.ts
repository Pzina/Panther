import Phaser from 'phaser';
import { VIEW_WIDTH } from '../config/constants';

/**
 * Common layout logic: the world is always 390 units wide, its height follows the device
 * aspect ratio, and the camera zoom maps it to the high-resolution canvas.
 */
export abstract class BaseScene extends Phaser.Scene {
  readonly W = VIEW_WIDTH;
  H = 844;
  protected rs = 1;

  create(): void {
    this.syncCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.teardown();
    });
    this.build();
    this.layout();
  }

  private syncCamera(): void {
    this.rs = this.scale.width / this.W;
    this.H = this.scale.height / this.rs;
    const cam = this.cameras.main;
    cam.setZoom(this.rs);
    cam.setScroll((this.W * (1 - this.rs)) / 2, (this.H * (1 - this.rs)) / 2);
  }

  private handleResize(): void {
    this.syncCamera();
    this.layout();
  }

  /** Creates the game objects (called once). */
  protected abstract build(): void;
  /** Positions everything for the current height (called at start and on resize). */
  protected abstract layout(): void;
  protected teardown(): void {
    /* optional */
  }
}
