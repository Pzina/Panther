import type Phaser from 'phaser';
import type { Cosmetic } from '../data/types';
import { mixNum } from './color';

type G = Phaser.GameObjects.Graphics;

/** Side view of the player's boat (title screen and port). Origin at the waterline centre. */
export function drawBoatSide(g: G, hull: Cosmetic, tier: number, scale = 1): void {
  const s = scale;
  const len = (58 + tier * 10) * s;
  const dark = mixNum(hull.color, 0x101820, 0.35);
  g.clear();
  // Hull.
  g.fillStyle(hull.color, 1);
  g.beginPath();
  g.moveTo(-len, -16 * s);
  g.lineTo(len * 1.08, -18 * s);
  g.lineTo(len * 0.8, 8 * s);
  g.lineTo(-len * 0.84, 8 * s);
  g.closePath();
  g.fillPath();
  g.fillStyle(dark, 1);
  g.fillRect(-len * 0.84, 4 * s, len * 1.64, 4 * s);
  g.fillStyle(hull.color2, 1);
  g.fillRect(-len * 0.97, -13 * s, len * 2.02, 4 * s);
  g.lineStyle(2 * s, 0x1d3344, 1);
  g.beginPath();
  g.moveTo(-len, -16 * s);
  g.lineTo(len * 1.08, -18 * s);
  g.lineTo(len * 0.8, 8 * s);
  g.lineTo(-len * 0.84, 8 * s);
  g.closePath();
  g.strokePath();
  if (tier >= 2) {
    // Small cabin.
    g.fillStyle(0xf6ecd2, 1);
    g.fillRect(-len * 0.5, -34 * s, len * 0.5, 18 * s);
    g.strokeRect(-len * 0.5, -34 * s, len * 0.5, 18 * s);
    g.fillStyle(0x8fd0e8, 1);
    g.fillRect(-len * 0.42, -30 * s, len * 0.14, 8 * s);
    g.fillRect(-len * 0.22, -30 * s, len * 0.14, 8 * s);
  }
  if (tier >= 3) {
    // Mast and sail.
    g.lineStyle(3 * s, 0x7a4a2c, 1);
    g.lineBetween(len * 0.18, -18 * s, len * 0.18, -92 * s);
    g.fillStyle(0xfbf5e6, 1);
    g.fillTriangle(len * 0.22, -88 * s, len * 0.22, -26 * s, len * 0.82, -26 * s);
    g.lineStyle(2 * s, 0x1d3344, 1);
    g.strokeTriangle(len * 0.22, -88 * s, len * 0.22, -26 * s, len * 0.82, -26 * s);
  } else {
    // Oar / small mast with a pennant.
    g.lineStyle(3 * s, 0x7a4a2c, 1);
    g.lineBetween(len * 0.2, -16 * s, len * 0.2, -52 * s);
    g.fillStyle(hull.color2, 1);
    g.fillTriangle(len * 0.2, -52 * s, len * 0.2, -42 * s, len * 0.44, -47 * s);
  }
  if (tier >= 4) {
    g.fillStyle(0x1d3344, 1);
    g.fillRect(-len * 0.7, -44 * s, 6 * s, 28 * s);
    g.fillStyle(0xe8a82e, 1);
    g.fillCircle(-len * 0.7 + 3 * s, -48 * s, 5 * s);
  }
}

/** Seagull (two arcs). `flap` in -1..1. */
export function drawGull(g: G, x: number, y: number, size: number, flap: number, color = 0xffffff): void {
  g.lineStyle(2, color, 0.9);
  g.beginPath();
  g.moveTo(x - size, y + flap * size * 0.4);
  g.lineTo(x - size * 0.4, y - size * 0.35 - flap * size * 0.15);
  g.lineTo(x, y);
  g.lineTo(x + size * 0.4, y - size * 0.35 - flap * size * 0.15);
  g.lineTo(x + size, y + flap * size * 0.4);
  g.strokePath();
}

/** Bobber drawn from above the water. */
export function drawBobber(g: G, x: number, y: number, cosmetic: Cosmetic, dip: number, scale = 1): void {
  const r = 8 * scale;
  const sink = dip * r * 1.5;
  switch (cosmetic.style) {
    case 'star': {
      g.fillStyle(cosmetic.color, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillTriangle(
          x + Math.cos(a) * r * 1.4,
          y + sink + Math.sin(a) * r * 1.4,
          x + Math.cos(a + 1.9) * r * 0.6,
          y + sink + Math.sin(a + 1.9) * r * 0.6,
          x + Math.cos(a - 1.9) * r * 0.6,
          y + sink + Math.sin(a - 1.9) * r * 0.6,
        );
      }
      g.fillStyle(cosmetic.color2, 1);
      g.fillCircle(x, y + sink, r * 0.45);
      break;
    }
    case 'lighthouse': {
      g.fillStyle(cosmetic.color, 1);
      g.fillRect(x - r * 0.5, y + sink - r * 1.8, r, r * 2.2);
      g.fillStyle(cosmetic.color2, 1);
      g.fillRect(x - r * 0.5, y + sink - r * 1.2, r, r * 0.5);
      g.fillRect(x - r * 0.5, y + sink - r * 0.2, r, r * 0.5);
      g.fillTriangle(x - r * 0.7, y + sink - r * 1.8, x + r * 0.7, y + sink - r * 1.8, x, y + sink - r * 2.6);
      break;
    }
    case 'moon': {
      g.fillStyle(cosmetic.color, 1);
      g.fillCircle(x, y + sink - r * 0.4, r);
      g.fillStyle(cosmetic.color2, 1);
      g.fillCircle(x + r * 0.45, y + sink - r * 0.7, r * 0.75);
      break;
    }
    default: {
      g.fillStyle(cosmetic.color2, 1);
      g.fillCircle(x, y + sink - r * 0.3, r);
      g.fillStyle(cosmetic.color, 1);
      g.slice(x, y + sink - r * 0.3, r, Math.PI, 0, false);
      g.fillPath();
      if (cosmetic.style === 'striped') {
        g.fillStyle(cosmetic.color2, 1);
        g.fillRect(x - r * 0.2, y + sink - r * 1.3, r * 0.4, r);
      }
      g.lineStyle(2, 0x1d3344, 1);
      g.strokeCircle(x, y + sink - r * 0.3, r);
      g.lineBetween(x, y + sink - r * 1.3, x, y + sink - r * 2.2);
      if (cosmetic.style === 'glow') {
        g.fillStyle(cosmetic.color, 0.3);
        g.fillCircle(x, y + sink - r * 0.3, r * 2.2);
      }
    }
  }
}
