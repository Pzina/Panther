import { BALANCE } from '../config/balance';
import type { DayPhase, Season } from '../data/types';
import { SEASONS } from '../data/types';

export const MINUTES_PER_DAY = 24 * 60;

/** In-game minutes that pass for one real second. */
export function gameMinutesPerRealSecond(): number {
  return MINUTES_PER_DAY / (BALANCE.clock.realMinutesPerDay * 60);
}

export function dayOf(clockMinutes: number): number {
  return Math.floor(clockMinutes / MINUTES_PER_DAY) + 1;
}

/** Hour of the day as a float in [0, 24). */
export function hourOf(clockMinutes: number): number {
  return (((clockMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60;
}

export function phaseOfHour(hour: number): DayPhase {
  const p = BALANCE.phases;
  if (hour >= p.dawn[0] && hour < p.dawn[1]) return 'dawn';
  if (hour >= p.day[0] && hour < p.day[1]) return 'day';
  if (hour >= p.dusk[0] && hour < p.dusk[1]) return 'dusk';
  return 'night';
}

export function phaseOf(clockMinutes: number): DayPhase {
  return phaseOfHour(hourOf(clockMinutes));
}

export function seasonOf(clockMinutes: number): Season {
  const day = dayOf(clockMinutes) - 1;
  return SEASONS[Math.floor(day / BALANCE.clock.daysPerSeason) % SEASONS.length]!;
}

export function dayOfSeason(clockMinutes: number): number {
  return ((dayOf(clockMinutes) - 1) % BALANCE.clock.daysPerSeason) + 1;
}

/** Minutes to wait until the given phase starts (0 < result <= one day). */
export function minutesUntilPhase(clockMinutes: number, phase: DayPhase): number {
  const startHour = BALANCE.phases[phase][0];
  const now = hourOf(clockMinutes);
  let delta = startHour - now;
  if (delta <= 0) delta += 24;
  return Math.round(delta * 60);
}

export function formatClock(clockMinutes: number): string {
  const total = Math.floor(((clockMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  const h = Math.floor(total / 60);
  const m = Math.floor((total % 60) / 10) * 10;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local calendar date (YYYY-MM-DD) used for daily missions and login bonuses. */
export function realDateKey(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetween(dateKeyA: string, dateKeyB: string): number {
  const a = Date.parse(`${dateKeyA}T00:00:00`);
  const b = Date.parse(`${dateKeyB}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86400000);
}
