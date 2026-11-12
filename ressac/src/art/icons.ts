import type { DayPhase, Rarity, Weather } from '../data/types';

/** Stroke icons drawn in code (24 × 24 grid). No icon font, no image file. */
const PATHS: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0"/>',
  fish: '<path d="M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2z"/><circle cx="7.5" cy="11" r="0.8" fill="currentColor"/>',
  hook: '<circle cx="14" cy="4.2" r="1.7"/><path d="M14 6v8.5a4.5 4.5 0 01-9 0V12l2.6 2.6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  book: '<path d="M5 4h13a1 1 0 011 1v15H7a2 2 0 01-2-2zM5 18a2 2 0 012-2h12M9 8h6M9 11.5h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v4M8 20h8"/>',
  shop: '<path d="M3 9l2-5h14l2 5M4.5 10.5V20h15v-9.5M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9.5 20v-5.5h5V20"/>',
  lock: '<rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z"/>',
  dawn: '<path d="M3 18h18M7 18a5 5 0 0110 0M12 5v4M12 5l-2 2M12 5l2 2M5 11l1.6 1.6M19 11l-1.6 1.6"/>',
  dusk: '<path d="M3 18h18M7 18a5 5 0 0110 0M12 9V5M12 9l-2-2M12 9l2-2M5 11l1.6 1.6M19 11l-1.6 1.6"/>',
  cloud: '<path d="M7 18a4 4 0 01-.5-8 5.5 5.5 0 0110.6 1.2A3.5 3.5 0 0117 18z"/>',
  rain: '<path d="M7 14a4 4 0 01-.5-8 5.5 5.5 0 0110.6 1.2A3.5 3.5 0 0117 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  storm: '<path d="M7 14a4 4 0 01-.5-8 5.5 5.5 0 0110.6 1.2A3.5 3.5 0 0117 14zM12.5 13l-3 4.5h3.5l-2 4"/>',
  fog: '<path d="M4 7h16M6 11h14M4 15h12M8 19h10"/>',
  sparkle:
    '<path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
  anchor: '<circle cx="12" cy="4.5" r="2"/><path d="M12 6.5V21M5 13a7 7 0 0014 0M8.5 10h7"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  play: '<path d="M8 4.5l11 7.5-11 7.5z"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  volume: '<path d="M4 9.5v5h4l5 4v-13l-5 4zM16.5 9a4.2 4.2 0 010 6M19 6.5a8 8 0 010 11"/>',
  vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M20 9v6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 10.5v-6a1.5 1.5 0 013 0V11M14 11V6.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7c-2.5 0-4-1-5.5-3.5L3 14a1.5 1.5 0 012.4-1.7L8 15"/>',
  text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bait: '<path d="M5 17c0-4.5 4-3.5 4-7.5s5.5-4 5.5 0-1.5 5 1.5 6 4-1 4-3.5"/><circle cx="5" cy="18.5" r="1" fill="currentColor"/>',
  rod: '<path d="M4 20L20 4M20 4v7M13 11l3 3"/><circle cx="8" cy="17.5" r="2"/>',
  reel: '<circle cx="11" cy="13" r="7"/><circle cx="11" cy="13" r="2"/><path d="M16 8l3.5-3.5M19.5 4.5l1 1"/>',
  line: '<path d="M7 4h10M7 20h10M9 4v16M15 4v16M9 8.5l6 2M9 12.5l6 2M9 16.5l6 2"/>',
  boat: '<path d="M3 15h18l-2.5 5h-13zM12 15V4l6 8h-6"/>',
  shirt: '<path d="M8 3l4 3 4-3 5 4-3 3.5-2-1.5v12H8V9l-2 1.5L3 7z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  calendar: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10.5h16M8 3.5v4M16 3.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 00-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-7.5-10.2a4.2 4.2 0 017.5-2.6 4.2 4.2 0 017.5 2.6C19.5 15.4 12 20 12 20z"/>',
  net: '<path d="M5 5h14l-2 11a5 5 0 01-10 0zM9.5 5l.8 15M14.5 5l-.8 15M6 10h12M7 14.5h10"/>',
  scroll:
    '<path d="M8 4h11v13a3 3 0 01-3 3H7a3 3 0 01-3-3v-1h9v1a3 3 0 003 3M8 4a2 2 0 00-2 2v10M10.5 8.5h5.5M10.5 12h5.5"/>',
  gift: '<path d="M4.5 11h15v9h-15zM3 7.5h18V11H3zM12 7.5V20M12 7.5C10 3.5 6 4.5 7.5 7.5M12 7.5c2-4 6-3 4.5 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.6"/>',
  trash: '<path d="M5 7h14M9.5 7V4h5v3M7 7l1 13h8l1-13"/>',
  sort: '<path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  crown: '<path d="M4 19h16M4.5 16L3 7l5 4 4-7 4 7 5-4-1.5 9z"/>',
  ruler: '<path d="M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2"/>',
  weight: '<path d="M6 9h12l2 11H4zM9 9a3 3 0 016 0"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  refresh: '<path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>',
  motion: '<path d="M4 8h10M4 12h15M4 16h7M17 6l3 2-3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>',
  wave: '<path d="M3 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  bed: '<path d="M3 19V7M3 15h18v4M21 15v-2.5a3 3 0 00-3-3h-7V15"/><circle cx="7" cy="11.5" r="1.8"/>',
  bobber: '<path d="M12 3v5M12 16v5"/><circle cx="12" cy="12" r="4.5"/><path d="M7.5 12h9"/>',
  level: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  aquarium:
    '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 13c1.5-2 4-2.2 6-.5l2.5-1.5v4l-2.5-1.5c-2 1.7-4.5 1.5-6-.5zM3 9.5h18"/>',
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c3-5 6-8 10-10"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  flower:
    '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5c-2-6 2-6 0 0M14.5 12c6-2 6 2 0 0M12 14.5c2 6-2 6 0 0M9.5 12c-6 2-6-2 0 0"/>',
  question:
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.5M12 17v.5"/>',
};

export function iconSvg(name: string, size = 24): string {
  const body = PATHS[name] ?? PATHS.question!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-${name}">${body}</svg>`;
}

export function hasIcon(name: string): boolean {
  return name in PATHS;
}

export const WEATHER_ICONS: Record<Weather, string> = {
  sun: 'sun',
  clouds: 'cloud',
  rain: 'rain',
  storm: 'storm',
  fog: 'fog',
  glow: 'sparkle',
};

export const PHASE_ICONS: Record<DayPhase, string> = {
  dawn: 'dawn',
  day: 'sun',
  dusk: 'dusk',
  night: 'moon',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7a8691',
  uncommon: '#2f9e5b',
  rare: '#2b7fd9',
  epic: '#8a4fd9',
  legendary: '#d99a12',
  mythic: '#e0457b',
};

const RARITY_SHAPES: Record<Rarity, string> = {
  common: '<circle cx="12" cy="12" r="7"/>',
  uncommon: '<path d="M12 3.5L20.5 12 12 20.5 3.5 12z"/>',
  rare: '<path d="M12 4l9 15.5H3z"/>',
  epic: '<path d="M12 3l8.5 6.2-3.2 10.3H6.7L3.5 9.2z"/>',
  legendary: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  mythic:
    '<path d="M12 1.5l2.3 5 5.1-2-2 5.1 5 2.4-5 2.3 2 5.1-5.1-2-2.3 5-2.3-5-5.1 2 2-5.1-5-2.3 5-2.4-2-5.1 5.1 2z"/>',
};

/**
 * Rarity marker: each rarity has its own colour AND its own shape, so that it never relies
 * on colour alone.
 */
export function raritySvg(rarity: Rarity, size = 18): string {
  const fill = rarity === 'mythic' ? 'url(#rarity-rainbow)' : RARITY_COLORS[rarity];
  const defs =
    rarity === 'mythic'
      ? '<defs><linearGradient id="rarity-rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset="0.25" stop-color="#ffc371"/><stop offset="0.5" stop-color="#47e5a0"/><stop offset="0.75" stop-color="#4aa8ff"/><stop offset="1" stop-color="#c86bff"/></linearGradient></defs>'
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" class="rarity-shape" aria-hidden="true">${defs}<g fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="1.2" stroke-linejoin="round">${RARITY_SHAPES[rarity]}</g></svg>`;
}
