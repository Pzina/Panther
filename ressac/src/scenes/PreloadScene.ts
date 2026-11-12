import Phaser from 'phaser';
import { fishDataUrl } from '../art/fish';
import { SPECIES } from '../data/species';
import type { VariantId } from '../data/types';

export const fishTextureKey = (speciesId: string, variant: VariantId = 'normal'): string =>
  `fish-${speciesId}-${variant}`;

/** Rasterises a procedural fish into a Phaser texture (resolves immediately when it exists). */
export function ensureFishTexture(
  scene: Phaser.Scene,
  speciesId: string,
  variant: VariantId = 'normal',
): Promise<string> {
  const key = fishTextureKey(speciesId, variant);
  if (scene.textures.exists(key)) return Promise.resolve(key);
  const species = SPECIES.find((s) => s.id === speciesId);
  if (!species) return Promise.resolve(key);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (!scene.textures.exists(key)) scene.textures.addImage(key, image);
      resolve(key);
    };
    image.onerror = () => resolve(key);
    image.src = fishDataUrl(species.art, { key: species.id, variant, pixelSize: 360 });
  });
}

/**
 * "Loading" here means generating: every species is drawn by code and turned into a texture.
 * The progress bar of the splash screen follows the real number of textures produced.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const total = SPECIES.length;
    let done = 0;
    const report = (): void => {
      this.game.events.emit('ressac-progress', done / total);
      if (done >= total) this.game.events.emit('ressac-ready');
    };
    report();
    // Small batches keep the splash animation fluid while textures are produced.
    const queue = [...SPECIES];
    const next = (): void => {
      const batch = queue.splice(0, 6);
      if (batch.length === 0) return;
      void Promise.all(batch.map((s) => ensureFishTexture(this, s.id))).then(() => {
        done += batch.length;
        report();
        next();
      });
    };
    next();
  }
}
