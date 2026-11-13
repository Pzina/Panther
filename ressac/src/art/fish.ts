import { hashSeed, Rng } from '../core/rng';
import type { BodyShape, FishArt, VariantId } from '../data/types';
import { darken, lighten, mix } from './color';

export interface FishSvgOptions {
  variant?: VariantId;
  /** Draws only the dark outline of an undiscovered species. */
  silhouette?: boolean;
  /** Unique key used for gradient / clip ids (species id + variant is enough). */
  key?: string;
  /** Adds width/height attributes (needed when the SVG is used as an image source). */
  pixelSize?: number;
  /** Disables SMIL animations (reduced motion, textures). */
  still?: boolean;
}

const VIEW_W = 240;
const VIEW_H = 140;
const CY = 70;

export interface Profile {
  peak: number;
  top: number;
  blunt: number;
  tailBase: number;
  taper: number;
}

export const PROFILES: Record<BodyShape, Profile> = {
  fusiform: { peak: 0.36, top: 0.5, blunt: 0.55, tailBase: 0.17, taper: 1 },
  round: { peak: 0.46, top: 0.5, blunt: 0.9, tailBase: 0.2, taper: 1.1 },
  eel: { peak: 0.2, top: 0.5, blunt: 0.75, tailBase: 0.34, taper: 0.7 },
  flat: { peak: 0.46, top: 0.6, blunt: 0.85, tailBase: 0.18, taper: 1.2 },
  deep: { peak: 0.4, top: 0.56, blunt: 0.78, tailBase: 0.19, taper: 1.05 },
  torpedo: { peak: 0.3, top: 0.48, blunt: 0.32, tailBase: 0.1, taper: 0.9 },
  puffer: { peak: 0.5, top: 0.5, blunt: 1, tailBase: 0.26, taper: 1.3 },
  angler: { peak: 0.27, top: 0.52, blunt: 1, tailBase: 0.13, taper: 0.85 },
};

const n = (v: number): string => (Math.round(v * 10) / 10).toString();

interface Geometry {
  x0: number;
  length: number;
  height: number;
  profile: Profile;
}

function geometry(art: FishArt): Geometry {
  let length = Math.min(165, Math.max(90, 70 + 22 * art.len));
  let height = length / art.len;
  if (height > 96) {
    height = 96;
    length = Math.max(84, 96 * art.len);
  }
  // Tall fins must stay inside the view box: shrink the whole fish when needed.
  const finFrac =
    art.dorsal === 'sail' ? 0.9 : art.dorsal === 'tall' ? 0.62 : art.dorsal === 'spiny' ? 0.42 : 0.3;
  const crest = art.extra === 'crest' || art.extra === 'lure' ? 0.5 : 0;
  const headroom = (PROFILES[art.body].top + Math.max(finFrac, crest)) * height;
  if (headroom > CY - 8) {
    const scale = (CY - 8) / headroom;
    height *= scale;
    length *= scale;
  }
  const tail = length * 0.22;
  const sword = art.extra === 'sword' ? 30 : 0;
  const total = length + tail + sword;
  const x0 = (VIEW_W - total) / 2 + sword;
  return { x0, length, height, profile: PROFILES[art.body] };
}

/** Body thickness factor (0..1) at position u along the body (0 = snout, 1 = tail base). */
export function thickness(p: Profile, u: number): number {
  if (u <= p.peak) {
    const e = 1 - 0.55 * p.blunt;
    return Math.pow(Math.sin((Math.PI / 2) * (u / p.peak)), e);
  }
  const v = (u - p.peak) / (1 - p.peak);
  const fall = Math.pow((1 + Math.cos(Math.PI * v)) / 2, p.taper);
  return p.tailBase + (1 - p.tailBase) * fall;
}

function topY(g: Geometry, u: number): number {
  return CY - g.profile.top * g.height * thickness(g.profile, u);
}
function bottomY(g: Geometry, u: number): number {
  return CY + (1 - g.profile.top) * g.height * thickness(g.profile, u);
}
function xAt(g: Geometry, u: number): number {
  return g.x0 + g.length * u;
}

function bodyPath(g: Geometry): string {
  const steps = 26;
  let d = `M${n(xAt(g, 0))} ${n(CY)}`;
  for (let i = 1; i <= steps; i++) d += `L${n(xAt(g, i / steps))} ${n(topY(g, i / steps))}`;
  for (let i = steps; i >= 1; i--) d += `L${n(xAt(g, i / steps))} ${n(bottomY(g, i / steps))}`;
  return `${d}Z`;
}

function tailPath(g: Geometry, art: FishArt): string {
  const xT = xAt(g, 1) - 2;
  const tb = g.profile.tailBase * g.height * 0.5;
  const tl = g.length * 0.22;
  const th = Math.max(tb * 1.6, Math.min(44, g.height * (art.body === 'eel' ? 0.55 : 0.5)));
  const top = CY - tb;
  const bot = CY + tb;
  switch (art.tail) {
    case 'fork':
      return `M${n(xT)} ${n(top)}L${n(xT + tl)} ${n(CY - th)}Q${n(xT + tl * 0.5)} ${n(CY)} ${n(xT + tl)} ${n(CY + th)}L${n(xT)} ${n(bot)}Z`;
    case 'lunate':
      return `M${n(xT)} ${n(top)}Q${n(xT + tl * 0.5)} ${n(CY - th * 0.5)} ${n(xT + tl * 1.05)} ${n(CY - th * 1.25)}Q${n(xT + tl * 0.3)} ${n(CY)} ${n(xT + tl * 1.05)} ${n(CY + th * 1.25)}Q${n(xT + tl * 0.5)} ${n(CY + th * 0.5)} ${n(xT)} ${n(bot)}Z`;
    case 'round':
      return `M${n(xT)} ${n(top)}C${n(xT + tl * 1.2)} ${n(CY - th * 1.1)} ${n(xT + tl * 1.2)} ${n(CY + th * 1.1)} ${n(xT)} ${n(bot)}Z`;
    case 'fan':
      return `M${n(xT)} ${n(top)}L${n(xT + tl * 0.95)} ${n(CY - th * 1.1)}Q${n(xT + tl * 1.35)} ${n(CY)} ${n(xT + tl * 0.95)} ${n(CY + th * 1.1)}L${n(xT)} ${n(bot)}Z`;
    case 'point':
      return `M${n(xT)} ${n(top)}Q${n(xT + tl * 0.6)} ${n(CY - tb * 0.9)} ${n(xT + tl * 1.25)} ${n(CY)}Q${n(xT + tl * 0.6)} ${n(CY + tb * 0.9)} ${n(xT)} ${n(bot)}Z`;
  }
}

/** Fin following the back (or the belly when `below`), between u0 and u1. */
function ridgeFin(
  g: Geometry,
  u0: number,
  u1: number,
  heightFrac: number,
  shape: (v: number) => number,
  below = false,
): string {
  const steps = 14;
  const edge = (u: number): number => (below ? bottomY(g, u) - 2 : topY(g, u) + 2);
  const dir = below ? 1 : -1;
  let d = `M${n(xAt(g, u0))} ${n(edge(u0))}`;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const u = u0 + (u1 - u0) * v;
    // Fins lean backwards.
    const lean = shape(v) * g.height * heightFrac * 0.35;
    d += `L${n(xAt(g, u) + lean)} ${n(edge(u) + dir * shape(v) * g.height * heightFrac)}`;
  }
  for (let i = steps; i >= 0; i--) {
    const u = u0 + (u1 - u0) * (i / steps);
    d += `L${n(xAt(g, u))} ${n(edge(u))}`;
  }
  return `${d}Z`;
}

const bump = (v: number): number => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.7)), 0.8);
const ribbon = (v: number): number => Math.min(1, Math.sin(Math.PI * v) * 2.2);
const spines = (v: number): number => bump(v) * (0.62 + 0.38 * Math.abs(Math.sin(v * Math.PI * 6)));
const sail = (v: number): number => Math.pow(Math.sin(Math.PI * Math.pow(v, 0.55)), 0.6);

function dorsalPath(g: Geometry, art: FishArt): string {
  switch (art.dorsal) {
    case 'low':
      return ridgeFin(g, 0.42, 0.66, 0.3, bump);
    case 'tall':
      return ridgeFin(g, 0.3, 0.62, 0.62, bump);
    case 'spiny':
      return ridgeFin(g, 0.24, 0.72, 0.42, spines);
    case 'long':
      return ridgeFin(g, 0.18, 0.9, 0.24, ribbon);
    case 'sail':
      return ridgeFin(g, 0.18, 0.74, 0.9, sail);
    case 'none':
      return '';
  }
}

function patternMarkup(g: Geometry, art: FishArt, c2: string, key: string): string {
  const x0 = g.x0;
  const L = g.length;
  const H = g.height;
  const rng = new Rng(hashSeed(key, art.pattern, art.c1));
  switch (art.pattern) {
    case 'plain':
      return '';
    case 'belly': {
      let d = `M${n(x0)} ${n(CY + H * 0.04)}`;
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        d += `L${n(xAt(g, u))} ${n(CY + H * 0.05 + Math.sin(u * Math.PI) * H * 0.04)}`;
      }
      d += `L${n(x0 + L)} ${n(CY + H)}L${n(x0)} ${n(CY + H)}Z`;
      return `<path d="${d}" fill="${c2}"/>`;
    }
    case 'stripes': {
      let out = '';
      const count = Math.max(4, Math.min(9, Math.round(L / 20)));
      for (let i = 0; i < count; i++) {
        const x = x0 + L * (0.2 + (0.74 * i) / count);
        const w = Math.max(4, (L / count) * 0.42);
        out += `<path d="M${n(x)} ${n(CY - H)}q${n(w * 0.6)} ${n(H)} 0 ${n(H * 2)}h${n(w)}q${n(w * 0.6)} ${n(-H)} 0 ${n(-H * 2)}z" fill="${c2}"/>`;
      }
      return out;
    }
    case 'bands': {
      const h = Math.max(4, H * 0.16);
      return `<rect x="${n(x0 + L * 0.12)}" y="${n(CY - h * 0.4)}" width="${n(L)}" height="${n(h)}" rx="${n(h / 2)}" fill="${c2}"/><rect x="${n(x0 + L * 0.3)}" y="${n(CY + H * 0.2)}" width="${n(L * 0.5)}" height="${n(h * 0.45)}" rx="${n(h / 4)}" fill="${c2}" opacity="0.6"/>`;
    }
    case 'spots': {
      let out = '';
      const count = Math.round(8 + L / 12);
      for (let i = 0; i < count; i++) {
        const u = rng.range(0.22, 0.95);
        const y = CY + rng.range(-0.42, 0.25) * H * thickness(g.profile, u);
        out += `<circle cx="${n(xAt(g, u))}" cy="${n(y)}" r="${n(rng.range(1.6, Math.max(2.4, H * 0.07)))}" fill="${c2}"/>`;
      }
      return out;
    }
    case 'scales': {
      let out = '';
      const size = Math.max(7, H * 0.2);
      for (let row = -3; row <= 3; row++) {
        for (let col = 0; col < L / size; col++) {
          const x = x0 + L * 0.2 + col * size + (row % 2 === 0 ? 0 : size / 2);
          const y = CY + row * size * 0.55;
          out += `<path d="M${n(x)} ${n(y - size * 0.3)}a${n(size * 0.5)} ${n(size * 0.5)} 0 0 0 0 ${n(size * 0.6)}" fill="none" stroke="${c2}" stroke-width="1.6" opacity="0.75"/>`;
        }
      }
      return out;
    }
    case 'glow': {
      let out = '';
      const count = Math.max(5, Math.round(L / 16));
      for (let i = 0; i < count; i++) {
        const u = 0.2 + (0.72 * i) / (count - 1);
        const y = CY + H * 0.12 * thickness(g.profile, u);
        const r = Math.max(2, H * 0.06);
        out += `<circle cx="${n(xAt(g, u))}" cy="${n(y)}" r="${n(r * 2.2)}" fill="${c2}" opacity="0.28"/><circle cx="${n(xAt(g, u))}" cy="${n(y)}" r="${n(r)}" fill="${lighten(c2, 0.35)}"/>`;
      }
      return out;
    }
    case 'marble': {
      let out = '';
      for (let i = 0; i < 7; i++) {
        const u = rng.range(0.15, 0.95);
        const y = CY + rng.range(-0.4, 0.35) * H;
        out += `<ellipse cx="${n(xAt(g, u))}" cy="${n(y)}" rx="${n(rng.range(L * 0.05, L * 0.12))}" ry="${n(rng.range(H * 0.08, H * 0.2))}" fill="${c2}" opacity="0.85" transform="rotate(${n(rng.range(-40, 40))} ${n(xAt(g, u))} ${n(y)})"/>`;
      }
      return out;
    }
  }
}

function sparkles(key: string, color: string, still: boolean): string {
  const rng = new Rng(hashSeed(key, 'sparkle'));
  let out = '';
  for (let i = 0; i < 6; i++) {
    const x = rng.range(30, VIEW_W - 30);
    const y = rng.range(18, VIEW_H - 18);
    const s = rng.range(3, 6.5);
    const anim = still
      ? ''
      : `<animate attributeName="opacity" values="0.15;1;0.15" dur="${n(rng.range(1.2, 2.4))}s" begin="${n(rng.range(0, 1.5))}s" repeatCount="indefinite"/>`;
    out += `<path d="M${n(x)} ${n(y - s)}L${n(x + s * 0.28)} ${n(y - s * 0.28)}L${n(x + s)} ${n(y)}L${n(x + s * 0.28)} ${n(y + s * 0.28)}L${n(x)} ${n(y + s)}L${n(x - s * 0.28)} ${n(y + s * 0.28)}L${n(x - s)} ${n(y)}L${n(x - s * 0.28)} ${n(y - s * 0.28)}Z" fill="${color}">${anim}</path>`;
  }
  return out;
}

export interface Palette {
  c1: string;
  c2: string;
  c3: string;
  pupil: string;
}

export function paletteFor(art: FishArt, variant: VariantId): Palette {
  switch (variant) {
    case 'albino':
      return { c1: '#f7f0ea', c2: '#f2c4bd', c3: '#f8ddd6', pupil: '#c0392b' };
    case 'melanic':
      return { c1: '#2b2d36', c2: '#4b4e5c', c3: '#1d1e25', pupil: '#0b0b10' };
    case 'golden':
      return { c1: '#f0b429', c2: '#fde08a', c3: '#d98c0a', pupil: '#3a2a08' };
    case 'shimmer':
      return {
        c1: mix(art.c1, '#b48cf2', 0.5),
        c2: '#ffffff',
        c3: mix(art.c3, '#7ee0f0', 0.5),
        pupil: '#1b2030',
      };
    default:
      return { c1: art.c1, c2: art.c2, c3: art.c3, pupil: '#1b2030' };
  }
}

/**
 * Draws a species from its parameters. Pure function: the same inputs always give the same SVG,
 * and two species with different parameters never look the same.
 */
export function fishSvg(art: FishArt, options: FishSvgOptions = {}): string {
  const variant = options.variant ?? 'normal';
  const key = (options.key ?? `${art.body}-${art.c1}`).replace(/[^a-z0-9-]/gi, '');
  const uid = `f-${key}-${variant}${options.silhouette ? '-s' : ''}`;
  const g = geometry(art);
  const pal = paletteFor(art, variant);
  const outline = darken(pal.c1, 0.55);
  const L = g.length;
  const H = g.height;
  const body = bodyPath(g);
  const tail = tailPath(g, art);
  const dorsal = dorsalPath(g, art);
  const anal =
    art.body === 'eel' ? ridgeFin(g, 0.3, 0.92, 0.16, ribbon, true) : ridgeFin(g, 0.6, 0.8, 0.26, bump, true);
  const size = options.pixelSize
    ? ` width="${options.pixelSize}" height="${Math.round((options.pixelSize * VIEW_H) / VIEW_W)}"`
    : '';
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}"${size} class="fish-svg" role="img">`;

  // Extras that are part of the outline (drawn in both modes).
  const snoutX = xAt(g, 0);
  let extraBack = '';
  let extraFront = '';
  const finFill = options.silhouette
    ? ''
    : ` fill="${pal.c3}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"`;
  if (art.extra === 'sword') {
    extraBack += `<path d="M${n(snoutX + 6)} ${n(CY - 3)}L${n(snoutX - 30)} ${n(CY + 1)}L${n(snoutX + 6)} ${n(CY + 4)}Z"${finFill}/>`;
  }
  if (art.extra === 'wings') {
    const wx = xAt(g, 0.3);
    extraFront += `<path d="M${n(wx)} ${n(CY + H * 0.05)}Q${n(wx + L * 0.2)} ${n(CY - H * 0.9)} ${n(wx + L * 0.5)} ${n(CY - H * 0.75)}Q${n(wx + L * 0.34)} ${n(CY - H * 0.2)} ${n(wx + L * 0.06)} ${n(CY + H * 0.12)}Z"${finFill}${options.silhouette ? '' : ' opacity="0.92"'}/>`;
  }
  if (art.extra === 'crest') {
    const cx = xAt(g, 0.16);
    const cy = topY(g, 0.16);
    for (let i = 0; i < 4; i++) {
      extraBack += `<path d="M${n(cx + i * 7)} ${n(cy + 3)}q${n(-6 - i)} ${n(-H * 0.34 - 6)} ${n(4)} ${n(-H * 0.44 - 8 + i * 3)}q${n(2)} ${n(H * 0.2)} ${n(4)} ${n(H * 0.44 + 8 - i * 3)}Z"${options.silhouette ? '' : ` fill="${mix(pal.c2, '#e8452e', variant === 'normal' ? 0.35 : 0)}" stroke="${outline}" stroke-width="1.6" stroke-linejoin="round"`}/>`;
    }
  }
  if (art.extra === 'horn') {
    const hx = xAt(g, 0.13);
    const hy = topY(g, 0.13);
    extraBack += `<path d="M${n(hx - 5)} ${n(hy + 4)}Q${n(hx - 4)} ${n(hy - H * 0.3 - 6)} ${n(hx + 9)} ${n(hy - H * 0.14 - 4)}Q${n(hx + 12)} ${n(hy)} ${n(hx + 14)} ${n(hy + 3)}Z"${options.silhouette ? '' : ` fill="${pal.c1}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"`}/>`;
  }
  let lure = '';
  if (art.extra === 'lure') {
    const lx = xAt(g, 0.14);
    const ly = topY(g, 0.14);
    const tipX = snoutX - 6;
    const tipY = ly - Math.max(18, H * 0.5);
    lure = `<path d="M${n(lx)} ${n(ly + 2)}Q${n(lx + 4)} ${n(tipY - 10)} ${n(tipX)} ${n(tipY)}" fill="none" stroke="${options.silhouette ? 'currentColor' : outline}" stroke-width="2.4" stroke-linecap="round"/>`;
    lure += options.silhouette
      ? `<circle cx="${n(tipX)}" cy="${n(tipY)}" r="5"/>`
      : `<circle cx="${n(tipX)}" cy="${n(tipY)}" r="11" fill="${pal.c2}" opacity="0.3"/><circle cx="${n(tipX)}" cy="${n(tipY)}" r="5.5" fill="${lighten(pal.c2, 0.4)}" stroke="${pal.c2}" stroke-width="1.5"/>`;
  }
  let spikes = '';
  if (art.body === 'puffer') {
    for (let i = 0; i < 14; i++) {
      const u = 0.12 + (0.76 * i) / 13;
      const up = i % 2 === 0;
      const y = up ? topY(g, u) : bottomY(g, u);
      spikes += `<path d="M${n(xAt(g, u) - 3)} ${n(y + (up ? 2 : -2))}L${n(xAt(g, u) + 1)} ${n(y + (up ? -7 : 7))}L${n(xAt(g, u) + 4)} ${n(y + (up ? 2 : -2))}Z"${options.silhouette ? '' : ` fill="${pal.c3}" stroke="${outline}" stroke-width="1.4" stroke-linejoin="round"`}/>`;
    }
  }

  if (options.silhouette) {
    return `${open}<g fill="currentColor">${extraBack}${dorsal ? `<path d="${dorsal}"/>` : ''}<path d="${anal}"/><path d="${tail}"/>${spikes}<path d="${body}"/>${extraFront}${lure}</g></svg>`;
  }

  const eyeR = Math.min(11, Math.max(3.4, H * 0.115)) * art.eye;
  const eyeU = Math.max(0.1, Math.min(0.2, (eyeR * 2.2) / L));
  const eyeX = xAt(g, eyeU) + (art.body === 'angler' ? 4 : 0);
  const eyeY = CY - g.profile.top * H * thickness(g.profile, eyeU) * 0.42;
  const eye = (cx: number, cy: number, r: number): string =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#ffffff" stroke="${outline}" stroke-width="1.6"/><circle cx="${n(cx - r * 0.12)}" cy="${n(cy)}" r="${n(r * 0.56)}" fill="${pal.pupil}"/><circle cx="${n(cx - r * 0.34)}" cy="${n(cy - r * 0.3)}" r="${n(r * 0.2)}" fill="#ffffff"/>`;
  let eyes = eye(eyeX, eyeY, eyeR);
  if (art.body === 'flat') eyes += eye(eyeX + eyeR * 2.3, eyeY - eyeR * 0.5, eyeR * 0.9);

  // Mouth.
  const mouthY = CY + H * 0.1 * thickness(g.profile, 0.06);
  let mouth: string;
  if (art.body === 'angler') {
    const mw = L * 0.26;
    mouth = `<path d="M${n(snoutX + 2)} ${n(CY + H * 0.02)}Q${n(snoutX + mw * 0.5)} ${n(CY + H * 0.3)} ${n(snoutX + mw)} ${n(CY + H * 0.1)}" fill="none" stroke="${outline}" stroke-width="2.6" stroke-linecap="round"/>`;
  } else {
    mouth = `<path d="M${n(snoutX + 1.5)} ${n(mouthY)}q${n(Math.max(5, L * 0.05))} ${n(3)} ${n(Math.max(8, L * 0.075))} ${n(0.5)}" fill="none" stroke="${outline}" stroke-width="2" stroke-linecap="round"/>`;
  }
  let teeth = '';
  if (art.extra === 'teeth' || art.body === 'angler') {
    const count = art.body === 'angler' ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const tx = snoutX + 4 + i * Math.max(4, L * 0.035);
      const ty =
        art.body === 'angler'
          ? CY + H * (0.07 + 0.045 * Math.sin((i / (count - 1)) * Math.PI) * 3)
          : mouthY + 1;
      teeth += `<path d="M${n(tx)} ${n(ty)}l2 ${n(-6 - (i % 2) * 2)}l2 ${n(6 + (i % 2) * 2)}z" fill="#ffffff" stroke="${outline}" stroke-width="0.8"/>`;
    }
  }
  let whiskers = '';
  if (art.extra === 'whiskers') {
    whiskers = `<path d="M${n(snoutX + 4)} ${n(mouthY + 2)}q${n(-8)} ${n(8)} ${n(-3)} ${n(15)}M${n(snoutX + 9)} ${n(mouthY + 3)}q${n(-3)} ${n(9)} ${n(5)} ${n(14)}" fill="none" stroke="${outline}" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  const gillX = xAt(g, Math.min(0.3, eyeU + 0.12));
  const gill = `<path d="M${n(gillX)} ${n(CY - H * 0.22)}q${n(H * 0.12)} ${n(H * 0.2)} 0 ${n(H * 0.42)}" fill="none" stroke="${outline}" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>`;
  const pecX = xAt(g, Math.min(0.42, eyeU + 0.2));
  const pectoral =
    art.extra === 'wings'
      ? ''
      : `<ellipse cx="${n(pecX)}" cy="${n(CY + H * 0.14)}" rx="${n(Math.max(6, L * 0.075))}" ry="${n(Math.max(3, H * 0.09))}" fill="${pal.c3}" stroke="${outline}" stroke-width="1.6" transform="rotate(24 ${n(pecX)} ${n(CY + H * 0.14)})" opacity="0.92"/>`;

  const shimmer = variant === 'shimmer';
  const bodyFill = shimmer ? `url(#${uid}-sh)` : pal.c1;
  const defs = `<defs><clipPath id="${uid}-c"><path d="${body}"/></clipPath><linearGradient id="${uid}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.28"/></linearGradient>${
    shimmer
      ? `<linearGradient id="${uid}-sh" x1="0" y1="0" x2="1" y2="0.4" gradientUnits="objectBoundingBox" spreadMethod="reflect"><stop offset="0" stop-color="#ff9ad5"/><stop offset="0.25" stop-color="#9ad8ff"/><stop offset="0.5" stop-color="#b9a2ff"/><stop offset="0.75" stop-color="#9affd0"/><stop offset="1" stop-color="#ffe79a"/>${options.still ? '' : '<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="2 0" dur="3s" repeatCount="indefinite"/>'}</linearGradient>`
      : ''
  }</defs>`;
  const fin = (d: string): string =>
    d ? `<path d="${d}" fill="${pal.c3}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/>` : '';
  const patternOpacity = shimmer ? 0.35 : 1;
  const deco =
    variant === 'golden'
      ? sparkles(uid, '#fff6c8', Boolean(options.still))
      : shimmer
        ? sparkles(uid, '#ffffff', Boolean(options.still))
        : '';

  return (
    `${open}${defs}` +
    `${extraBack}${fin(dorsal)}${fin(anal)}${fin(tail)}${spikes}` +
    `<path d="${body}" fill="${bodyFill}"/>` +
    `<g clip-path="url(#${uid}-c)"><g opacity="${patternOpacity}">${patternMarkup(g, art, pal.c2, key)}</g><rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="url(#${uid}-g)"/></g>` +
    `<path d="${body}" fill="none" stroke="${outline}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `${gill}${pectoral}${extraFront}${mouth}${teeth}${whiskers}${eyes}${lure}${deco}</svg>`
  );
}

/** Data URL usable as an <img> source. */
export function fishDataUrl(art: FishArt, options: FishSvgOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fishSvg(art, { ...options, still: true, pixelSize: options.pixelSize ?? 240 }))}`;
}
