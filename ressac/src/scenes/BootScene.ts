import Phaser from 'phaser';

/** First scene: nothing to load from disk, it only hands over to the preloader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
