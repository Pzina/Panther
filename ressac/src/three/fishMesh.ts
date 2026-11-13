import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { darken, lighten, mix } from '../art/color';
import { paletteFor, PROFILES, thickness, type Palette } from '../art/fish';
import { hashSeed, Rng } from '../core/rng';
import { getSpecies, SPECIES } from '../data/species';
import type { BodyShape, FishArt, VariantId } from '../data/types';

const WIDTH: Record<BodyShape, number> = {
  fusiform: 0.52,
  round: 0.46,
  eel: 0.85,
  flat: 0.26,
  deep: 0.36,
  torpedo: 0.68,
  puffer: 0.95,
  angler: 0.8,
};

interface Dim {
  H: number;
  top: (u: number) => number;
  bottom: (u: number) => number;
  half: (u: number) => number;
}

function dims(art: FishArt): Dim {
  const p = PROFILES[art.body];
  const H = Math.min(0.62, 1 / Math.max(1.3, art.len));
  const th = (u: number): number => thickness(p, Math.min(1, Math.max(0, u)));
  return {
    H,
    top: (u) => p.top * H * th(u),
    bottom: (u) => -(1 - p.top) * H * th(u),
    half: (u) => (H * th(u) * WIDTH[art.body]) / 2,
  };
}

/** Skin texture: countershading, the species pattern, scales, speckles. x = along the body, y = back → belly. */
function skinTexture(
  art: FishArt,
  pal: Palette,
  variant: VariantId,
  key: string,
): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture | null } {
  const W = 512;
  const Hh = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const g = c.getContext('2d')!;
  const rng = new Rng(hashSeed(key, 'skin'));
  const grad = g.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, darken(pal.c1, 0.5));
  grad.addColorStop(0.3, darken(pal.c1, 0.12));
  grad.addColorStop(0.6, pal.c1);
  grad.addColorStop(1, lighten(pal.c1, 0.4));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = pal.c2;
  g.strokeStyle = pal.c2;
  switch (art.pattern) {
    case 'belly': {
      const b = g.createLinearGradient(0, Hh * 0.48, 0, Hh * 0.62);
      b.addColorStop(0, 'rgba(0,0,0,0)');
      b.addColorStop(1, pal.c2);
      g.fillStyle = b;
      g.fillRect(0, Hh * 0.48, W, Hh * 0.52);
      break;
    }
    case 'stripes': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x = W * (0.2 + (0.75 * i) / n);
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 14, Hh * 0.3, x - 8, Hh * 0.6, x + 6, Hh * 0.86);
        g.lineTo(x + 6 + W * 0.045, Hh * 0.86);
        g.bezierCurveTo(x + W * 0.045 - 8, Hh * 0.6, x + W * 0.045 + 14, Hh * 0.3, x + W * 0.045, 0);
        g.fill();
      }
      break;
    }
    case 'bands':
      g.globalAlpha = 0.95;
      g.fillRect(W * 0.1, Hh * 0.4, W, Hh * 0.1);
      g.globalAlpha = 0.5;
      g.fillRect(W * 0.2, Hh * 0.62, W * 0.7, Hh * 0.04);
      g.globalAlpha = 1;
      break;
    case 'spots':
      for (let i = 0; i < 70; i++) {
        g.globalAlpha = rng.range(0.6, 1);
        g.beginPath();
        g.ellipse(rng.range(W * 0.18, W), rng.range(0, Hh * 0.68), rng.range(3, 8), rng.range(3, 7), 0, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
      break;
    case 'marble':
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = rng.range(0.5, 0.9);
        g.beginPath();
        g.ellipse(
          rng.range(0, W),
          rng.range(0, Hh * 0.8),
          rng.range(14, 44),
          rng.range(8, 22),
          rng.range(0, 3),
          0,
          7,
        );
        g.fill();
      }
      g.globalAlpha = 1;
      break;
    default:
      break;
  }
  if (variant === 'shimmer') {
    const r = g.createLinearGradient(0, 0, W, Hh);
    ['#ff9ad5', '#9ad8ff', '#b9a2ff', '#9affd0', '#ffe79a', '#ff9ad5'].forEach((col, i) =>
      r.addColorStop(i / 5, col),
    );
    g.globalAlpha = 0.6;
    g.fillStyle = r;
    g.fillRect(0, 0, W, Hh);
    g.globalAlpha = 1;
  }
  // Scales: rows of small overlapping arcs.
  const strong = art.pattern === 'scales';
  const size = strong ? 15 : 9;
  for (let row = 0; row < Hh / (size * 0.6); row++) {
    for (let col = 0; col < W / size + 1; col++) {
      const x = W * 0.2 + col * size + (row % 2 === 0 ? 0 : size / 2);
      if (x > W) continue;
      const y = row * size * 0.6;
      g.strokeStyle = strong ? pal.c2 : 'rgba(0,0,0,0.13)';
      g.globalAlpha = strong ? 0.8 : 1;
      g.lineWidth = strong ? 1.8 : 1;
      g.beginPath();
      g.arc(x, y, size * 0.55, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.arc(x - 1.5, y, size * 0.55, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // Head: smoother skin, gill cover and mouth.
  const head = g.createLinearGradient(0, 0, W * 0.24, 0);
  head.addColorStop(0, mix(pal.c1, '#000000', 0.12));
  head.addColorStop(0.8, mix(pal.c1, '#000000', 0.0));
  g.globalAlpha = 0.55;
  g.fillStyle = head;
  g.fillRect(0, 0, W * 0.2, Hh * 0.7);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(W * 0.2, Hh * 0.5, W * 0.035, Hh * 0.36, 0, -1.3, 1.3);
  g.stroke();
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(0, Hh * 0.6);
  g.quadraticCurveTo(W * 0.05, Hh * 0.66, W * 0.085, Hh * 0.6);
  g.stroke();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rng.chance(0.5) ? '0,0,0' : '255,255,255'},${rng.range(0.02, 0.09)})`;
    g.fillRect(rng.range(0, W), rng.range(0, Hh), 2, 2);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  let glow: THREE.CanvasTexture | null = null;
  if (art.pattern === 'glow') {
    const e = document.createElement('canvas');
    e.width = W;
    e.height = Hh;
    const eg = e.getContext('2d')!;
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 11; i++) {
      const x = W * (0.2 + 0.07 * i);
      const y = Hh * 0.58;
      const rg = eg.createRadialGradient(x, y, 0, x, y, 14);
      rg.addColorStop(0, lighten(pal.c2, 0.4));
      rg.addColorStop(0.35, pal.c2);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      eg.fillStyle = rg;
      eg.fillRect(x - 14, y - 14, 28, 28);
    }
    glow = new THREE.CanvasTexture(e);
    glow.colorSpace = THREE.SRGBColorSpace;
  }
  return { map, glow };
}

function bodyGeometry(d: Dim): THREE.BufferGeometry {
  const rings = 34;
  const seg = 16;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings + 1; i++) {
    const u = i > rings ? 1 : Math.pow(i / rings, 1.25);
    const shrink = i > rings ? 0.02 : 1;
    const cy = (d.top(u) + d.bottom(u)) / 2;
    const ry = ((d.top(u) - d.bottom(u)) / 2) * shrink;
    const rz = d.half(u) * shrink;
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      // Slightly flattened sides: more fish-like than a pure ellipse.
      const side = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.8);
      pos.push(-0.5 + u + (i > rings ? 0.015 : 0), cy + ry * Math.cos(a), rz * side);
      uv.push(u, 1 - (1 - Math.cos(a)) / 2);
    }
  }
  for (let i = 0; i <= rings; i++) {
    for (let s = 0; s < seg; s++) {
      const a = i * (seg + 1) + s;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const bump = (v: number): number => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.7)), 0.8);
const ribbon = (v: number): number => Math.min(1, Math.sin(Math.PI * v) * 2.2);
const spines = (v: number): number => bump(v) * (0.62 + 0.38 * Math.abs(Math.sin(v * Math.PI * 6)));
const sail = (v: number): number => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.55)), 0.6);

function ridge(
  d: Dim,
  u0: number,
  u1: number,
  frac: number,
  fn: (v: number) => number,
  below = false,
): THREE.Shape {
  const shape = new THREE.Shape();
  const edge = (u: number): number => (below ? d.bottom(u) + 0.006 : d.top(u) - 0.006);
  const dir = below ? -1 : 1;
  shape.moveTo(-0.5 + u0, edge(u0));
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const u = u0 + (u1 - u0) * v;
    shape.lineTo(-0.5 + u + fn(v) * d.H * frac * 0.35, edge(u) + dir * fn(v) * d.H * frac);
  }
  for (let i = n; i >= 0; i--) {
    const u = u0 + (u1 - u0) * (i / n);
    shape.lineTo(-0.5 + u, edge(u));
  }
  return shape;
}

function tailShape(art: FishArt, d: Dim): THREE.Shape {
  const s = new THREE.Shape();
  const x = 0.49;
  const tb = PROFILES[art.body].tailBase * d.H * 0.5;
  const tl = 0.22;
  const th = Math.max(tb * 1.6, Math.min(0.3, d.H * (art.body === 'eel' ? 0.55 : 0.5)));
  const cy = (d.top(1) + d.bottom(1)) / 2;
  s.moveTo(x, cy + tb);
  switch (art.tail) {
    case 'fork':
      s.lineTo(x + tl, cy + th);
      s.quadraticCurveTo(x + tl * 0.5, cy, x + tl, cy - th);
      break;
    case 'lunate':
      s.quadraticCurveTo(x + tl * 0.5, cy + th * 0.5, x + tl * 1.05, cy + th * 1.25);
      s.quadraticCurveTo(x + tl * 0.3, cy, x + tl * 1.05, cy - th * 1.25);
      s.quadraticCurveTo(x + tl * 0.5, cy - th * 0.5, x, cy - tb);
      break;
    case 'round':
      s.bezierCurveTo(x + tl * 1.2, cy + th * 1.1, x + tl * 1.2, cy - th * 1.1, x, cy - tb);
      break;
    case 'fan':
      s.lineTo(x + tl * 0.95, cy + th * 1.1);
      s.quadraticCurveTo(x + tl * 1.35, cy, x + tl * 0.95, cy - th * 1.1);
      break;
    case 'point':
      s.quadraticCurveTo(x + tl * 0.6, cy + tb * 0.9, x + tl * 1.25, cy);
      s.quadraticCurveTo(x + tl * 0.6, cy - tb * 0.9, x, cy - tb);
      break;
  }
  s.lineTo(x, cy - tb);
  return s;
}

/** Translucent fin membrane with rays. */
function finTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(i * 5 - 20, 128);
    g.lineTo(i * 5 + 20, 0);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

/**
 * Models a species in 3D from its drawing parameters. The fish is one unit long, head towards -x.
 */
export function buildFish(art: FishArt, variant: VariantId = 'normal', key = 'fish'): THREE.Group {
  const group = new THREE.Group();
  const pal = paletteFor(art, variant);
  const d = dims(art);
  const { map, glow } = skinTexture(art, pal, variant, key);
  const skin = new THREE.MeshPhysicalMaterial({
    map,
    roughness: variant === 'golden' ? 0.25 : 0.38,
    metalness: variant === 'golden' ? 0.75 : variant === 'shimmer' ? 0.35 : 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    iridescence: variant === 'shimmer' ? 1 : 0.25,
    iridescenceIOR: 1.4,
    emissive: glow ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveMap: glow ?? null,
    emissiveIntensity: glow ? 2.2 : 0,
  });
  const body = new THREE.Mesh(bodyGeometry(d), skin);
  body.castShadow = true;
  group.add(body);

  const finMat = new THREE.MeshPhysicalMaterial({
    map: finTexture(pal.c3),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    roughness: 0.45,
    clearcoat: 0.5,
    metalness: variant === 'golden' ? 0.5 : 0.05,
  });
  const fin = (shape: THREE.Shape): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), finMat);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  fin(tailShape(art, d));
  if (art.dorsal === 'low') fin(ridge(d, 0.42, 0.66, 0.3, bump));
  else if (art.dorsal === 'tall') fin(ridge(d, 0.3, 0.62, 0.62, bump));
  else if (art.dorsal === 'spiny') fin(ridge(d, 0.24, 0.72, 0.42, spines));
  else if (art.dorsal === 'long') fin(ridge(d, 0.18, 0.9, 0.24, ribbon));
  else if (art.dorsal === 'sail') fin(ridge(d, 0.18, 0.74, 0.9, sail));
  fin(art.body === 'eel' ? ridge(d, 0.3, 0.92, 0.16, ribbon, true) : ridge(d, 0.6, 0.8, 0.26, bump, true));
  // Pectoral fins (or wings), one on each side.
  const pecU = 0.3;
  const wing = art.extra === 'wings';
  const pec = new THREE.Shape();
  const pl = wing ? 0.42 : Math.max(0.08, d.H * 0.42);
  pec.moveTo(0, 0);
  pec.quadraticCurveTo(pl * 0.5, pl * (wing ? 0.5 : 0.42), pl, pl * 0.12);
  pec.quadraticCurveTo(pl * 0.6, -pl * 0.2, 0, -pl * 0.1);
  for (const side of [-1, 1]) {
    const mesh = fin(pec);
    mesh.position.set(-0.5 + pecU, d.bottom(pecU) * 0.35, side * d.half(pecU) * 0.95);
    mesh.rotation.set(side * (wing ? 1.15 : 0.5), side * -0.5, -0.25);
  }

  // Eyes.
  const eyeR = Math.min(0.05, Math.max(0.016, d.H * 0.115)) * art.eye;
  const eyeU = Math.max(0.1, Math.min(0.2, eyeR * 2.6));
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: variant === 'albino' ? 0xf2d0d0 : 0xe8e4d4,
    roughness: 0.08,
    clearcoat: 1,
  });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: pal.pupil, roughness: 0.05, clearcoat: 1 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 10), eyeMat);
    eye.position.set(-0.5 + eyeU, d.top(eyeU) * 0.42, side * (d.half(eyeU) * 0.82));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.62, 12, 8), pupilMat);
    pupil.position.set(-eyeR * 0.1, 0, side * eyeR * 0.52);
    eye.add(pupil);
    group.add(eye);
  }

  // Extras.
  const solid = new THREE.MeshPhysicalMaterial({ color: pal.c3, roughness: 0.4, clearcoat: 0.6 });
  if (art.extra === 'sword') {
    const sword = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.3, 8), solid);
    sword.rotation.z = Math.PI / 2;
    sword.position.set(-0.63, 0.005, 0);
    group.add(sword);
  }
  if (art.extra === 'whiskers') {
    for (const side of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.47, -0.012, side * 0.012),
        new THREE.Vector3(-0.5, -0.06, side * 0.05),
        new THREE.Vector3(-0.45, -0.1, side * 0.06),
      );
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.004, 5), solid));
    }
  }
  if (art.extra === 'lure') {
    const base = new THREE.Vector3(-0.36, d.top(0.14), 0);
    const tip = new THREE.Vector3(-0.56, d.top(0.14) + Math.max(0.1, d.H * 0.5), 0);
    const curve = new THREE.QuadraticBezierCurve3(base, new THREE.Vector3(-0.38, tip.y + 0.06, 0), tip);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.006, 5), solid));
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 8),
      new THREE.MeshStandardMaterial({
        color: pal.c2,
        emissive: new THREE.Color(pal.c2),
        emissiveIntensity: 3,
      }),
    );
    bulb.position.copy(tip);
    group.add(bulb);
  }
  if (art.extra === 'horn') {
    const horn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    horn.scale.set(1.1, 1.4, 0.8);
    horn.position.set(-0.37, d.top(0.13) + 0.012, 0);
    group.add(horn);
  }
  if (art.extra === 'crest') {
    const crestMat = finMat.clone();
    crestMat.map = finTexture(mix(pal.c2, '#e8452e', variant === 'normal' ? 0.5 : 0));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(ridge(d, 0.08, 0.3, 0.75, spines), 6), crestMat);
    group.add(mesh);
  }
  if (art.extra === 'teeth' || art.body === 'angler') {
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const tooth = new THREE.Mesh(
          new THREE.ConeGeometry(0.005, 0.03, 5),
          new THREE.MeshStandardMaterial({ color: 0xf6f2e6, roughness: 0.3 }),
        );
        tooth.position.set(
          -0.49 + i * 0.015,
          d.bottom(0.03 + i * 0.015) * 0.5 + 0.008,
          side * d.half(0.03 + i * 0.015) * 0.7,
        );
        tooth.rotation.z = Math.PI;
        group.add(tooth);
      }
    }
  }
  if (art.body === 'puffer') {
    const rng = new Rng(hashSeed(key, 'spikes'));
    for (let i = 0; i < 46; i++) {
      const u = rng.range(0.12, 0.85);
      const a = rng.range(0, Math.PI * 2);
      const cy = (d.top(u) + d.bottom(u)) / 2;
      const ry = (d.top(u) - d.bottom(u)) / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.045, 5), solid);
      const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      spike.position.set(-0.5 + u, cy + ry * Math.cos(a), d.half(u) * Math.sin(a));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      group.add(spike);
    }
  }
  return group;
}

// ───────────────────────── Portraits for the notebook and the cards ─────────────────────────

const IMG_W = 480;
const IMG_H = 280;
let studio: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  holder: THREE.Group;
} | null = null;
const images = new Map<string, string>();

function getStudio(): NonNullable<typeof studio> {
  if (studio) return studio;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(IMG_W, IMG_H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-1.5, 3, 4);
  const rim = new THREE.DirectionalLight(0xbfdcff, 0.6);
  rim.position.set(2, 1, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.12));
  const camera = new THREE.OrthographicCamera(-0.8, 0.8, 0.47, -0.47, 0.1, 20);
  camera.position.set(-0.25, 0.12, 5);
  camera.lookAt(0, 0, 0);
  const holder = new THREE.Group();
  scene.add(holder);
  studio = { renderer, scene, camera, holder };
  return studio;
}

/** Picture (data URL) of a species, rendered once from its 3D model. */
export function fishImage(speciesId: string, variant: VariantId = 'normal'): string {
  const key = `${speciesId}-${variant}`;
  const hit = images.get(key);
  if (hit) return hit;
  const st = getStudio();
  const species = getSpecies(speciesId);
  const fish = buildFish(species.art, variant, species.id);
  const bounds = new THREE.Box3().setFromObject(fish);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(1.42 / size.x, 0.82 / size.y);
  fish.scale.setScalar(scale);
  fish.position.set(-centre.x * scale, -centre.y * scale, 0);
  st.holder.add(fish);
  st.renderer.render(st.scene, st.camera);
  const url = st.renderer.domElement.toDataURL('image/png');
  st.holder.remove(fish);
  fish.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as
      (THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null }) | undefined;
    mat?.map?.dispose();
    mat?.emissiveMap?.dispose();
    mat?.dispose?.();
  });
  images.set(key, url);
  return url;
}

/**
 * Models and photographs the species of the first zone (the others are done on demand, the
 * first time they are shown) and reports real progress to the splash screen.
 */
export async function preloadFishImages(onProgress: (ratio: number) => void): Promise<void> {
  const first = SPECIES.filter((s) => s.zones.includes('anse'));
  for (let i = 0; i < first.length; i++) {
    fishImage(first[i]!.id);
    onProgress((i + 1) / first.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
