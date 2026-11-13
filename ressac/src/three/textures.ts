import * as THREE from 'three';
import { Rng } from '../core/rng';

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(canvas: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

const cache = new Map<string, THREE.CanvasTexture>();

/** Weathered wooden planks. */
export function woodTexture(base = '#9a7448', repeat = 1): THREE.CanvasTexture {
  const key = `wood-${base}-${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvasOf(256, 256);
  const rng = new Rng(77);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 4; p++) {
    const y = p * 64;
    g.fillStyle = `rgba(${rng.int(0, 40)},${rng.int(0, 25)},0,${rng.range(0.03, 0.16)})`;
    g.fillRect(0, y, 256, 64);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(${rng.chance(0.5) ? '40,24,8' : '255,235,200'},${rng.range(0.04, 0.16)})`;
      g.lineWidth = rng.range(0.5, 1.6);
      const yy = y + rng.range(2, 62);
      g.beginPath();
      g.moveTo(0, yy);
      g.bezierCurveTo(80, yy + rng.range(-3, 3), 170, yy + rng.range(-3, 3), 256, yy);
      g.stroke();
    }
    g.fillStyle = 'rgba(20,12,4,0.55)';
    g.fillRect(0, y, 256, 2);
    const joint = rng.range(30, 220);
    g.fillRect(joint, y, 2, 64);
    g.fillStyle = 'rgba(30,30,30,0.5)';
    g.beginPath();
    g.arc(joint + 8, y + 10, 2, 0, 7);
    g.arc(joint - 8, y + 54, 2, 0, 7);
    g.fill();
  }
  const tex = finish(c, repeat);
  cache.set(key, tex);
  return tex;
}

/** Slightly uneven paint (hulls, walls). */
export function paintTexture(color: string): THREE.CanvasTexture {
  const key = `paint-${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvasOf(128, 128);
  const rng = new Rng(5);
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(${rng.chance(0.5) ? '0,0,0' : '255,255,255'},${rng.range(0.01, 0.06)})`;
    g.fillRect(rng.range(0, 128), rng.range(0, 128), rng.range(2, 22), rng.range(1, 3));
  }
  const tex = finish(c, 2);
  cache.set(key, tex);
  return tex;
}

/** Soft round sprite for particles and glows. */
export function dotTexture(): THREE.CanvasTexture {
  const hit = cache.get('dot');
  if (hit) return hit;
  const [c, g] = canvasOf(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  cache.set('dot', tex);
  return tex;
}

/** "!" marker shown when a fish bites. */
export function bangTexture(): THREE.CanvasTexture {
  const hit = cache.get('bang');
  if (hit) return hit;
  const [c, g] = canvasOf(128, 256);
  g.font = '900 230px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 26;
  g.lineJoin = 'round';
  g.strokeStyle = '#1d3344';
  g.strokeText('!', 64, 132);
  g.fillStyle = '#ffe36a';
  g.fillText('!', 64, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('bang', tex);
  return tex;
}

export function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
