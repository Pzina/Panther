import { BALANCE } from '../config/balance';
import { hourOf, phaseOfHour, seasonOf } from '../core/clock';
import { hashSeed, Rng } from '../core/rng';
import type { Season, Weather, ZoneId } from '../data/types';
import { getZone } from '../data/zones';

const SEASON_BIAS: Record<Season, Partial<Record<Weather, number>>> = {
  spring: { rain: 1.3 },
  summer: { sun: 1.5, storm: 1.2, fog: 0.6 },
  autumn: { rain: 1.3, fog: 1.5, clouds: 1.2 },
  winter: { fog: 1.4, storm: 1.4, sun: 0.7 },
};

function slotOf(clockMinutes: number): number {
  return Math.floor(clockMinutes / (BALANCE.clock.weatherSlotHours * 60));
}

/** Weather is a pure function of the world seed, the zone and the time: nothing to store. */
export function weatherAt(seed: number, zone: ZoneId, clockMinutes: number): Weather {
  const slot = slotOf(clockMinutes);
  const z = getZone(zone);
  if (!z.permanentNight) {
    const slotStart = slot * BALANCE.clock.weatherSlotHours * 60;
    const phase = phaseOfHour(hourOf(slotStart));
    if (phase === 'night' && new Rng(hashSeed(seed, 'glow', slot)).next() < BALANCE.clock.glowChance) {
      return 'glow';
    }
  }
  const season = seasonOf(clockMinutes);
  const bias = SEASON_BIAS[season];
  const rng = new Rng(hashSeed(seed, zone, slot));
  const entries = (Object.entries(z.weatherWeights) as [Weather, number][]).map(([item, weight]) => ({
    item,
    weight: weight * (bias[item] ?? 1),
  }));
  return rng.weighted(entries) ?? 'clouds';
}

/** In-game minutes before the weather of the zone may change. */
export function minutesUntilWeatherChange(clockMinutes: number): number {
  const slotMinutes = BALANCE.clock.weatherSlotHours * 60;
  return slotMinutes - (clockMinutes % slotMinutes);
}
