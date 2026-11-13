import type { Weather } from '../data/types';

function mixNum(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

const SKY: { h: number; top: number; bottom: number }[] = [
  { h: 0, top: 0x03060f, bottom: 0x0a1428 },
  { h: 4.6, top: 0x03060f, bottom: 0x0a1428 },
  { h: 6.2, top: 0x27467a, bottom: 0xf2a070 },
  { h: 8.5, top: 0x1c5fb5, bottom: 0xb9d7ee },
  { h: 16.5, top: 0x1c5fb5, bottom: 0xb9d7ee },
  { h: 19.2, top: 0x2b3f7a, bottom: 0xf58a4e },
  { h: 20.6, top: 0x0b1433, bottom: 0x3a3358 },
  { h: 21.6, top: 0x03060f, bottom: 0x0a1428 },
  { h: 24, top: 0x03060f, bottom: 0x0a1428 },
];

/** 0 in full daylight, 1 in the middle of the night. */
export function nightness(hour: number): number {
  if (hour < 5 || hour >= 21) return 1;
  if (hour < 7) return 1 - (hour - 5) / 2;
  if (hour >= 19) return (hour - 19) / 2;
  return 0;
}

/** Zenith and horizon colours for an hour of the day and a weather. */
export function skyColors(hour: number, weather: Weather): { top: number; bottom: number } {
  let a = SKY[0]!;
  let b = SKY[SKY.length - 1]!;
  for (let i = 0; i < SKY.length - 1; i++) {
    if (hour >= SKY[i]!.h && hour <= SKY[i + 1]!.h) {
      a = SKY[i]!;
      b = SKY[i + 1]!;
      break;
    }
  }
  const t = b.h > a.h ? (hour - a.h) / (b.h - a.h) : 0;
  let top = mixNum(a.top, b.top, t);
  let bottom = mixNum(a.bottom, b.bottom, t);
  const amount =
    weather === 'storm'
      ? 0.85
      : weather === 'rain'
        ? 0.7
        : weather === 'fog'
          ? 0.75
          : weather === 'clouds'
            ? 0.3
            : 0;
  if (amount > 0) {
    const dark = nightness(hour);
    const grey = weather === 'storm' ? 0x3c4650 : weather === 'fog' ? 0xb4bfc6 : 0x8794a0;
    const g = mixNum(grey, 0x080c14, dark * 0.9);
    top = mixNum(top, mixNum(g, 0x000000, 0.25), amount);
    bottom = mixNum(bottom, g, amount);
  }
  return { top, bottom };
}
