import type Phaser from 'phaser';
import type { AudioEngine } from './audio/engine';
import type { Game } from './core/game';
import type { SaveManager } from './core/save';
import type { Ui } from './ui/ui';

/** Shared services of the running application (filled by main.ts). */
export interface AppContext {
  game: Game;
  saves: SaveManager;
  audio: AudioEngine;
  ui: Ui;
  phaser: Phaser.Game | null;
  /** `?debug=1`: debug panel with coins and unlocks. */
  debug: boolean;
  /** Saves the game right now (also called every 30 s). */
  save: () => void;
  /** Replaces the current game with another state (new game, import, backup). */
  loadState: (state: import('./core/state').GameState) => void;
  /** Vibration helper honouring the player's setting. */
  haptic: (pattern: number | number[]) => void;
  /** Applies settings that live outside the game rules (volumes, text size, handedness…). */
  applySettings: () => void;
  hasSave: () => boolean;
}

export const app = {} as AppContext;
