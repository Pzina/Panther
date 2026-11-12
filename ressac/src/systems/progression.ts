import { BALANCE } from '../config/balance';
import type { GameState } from '../core/state';
import { SPECIES, speciesOfZone } from '../data/species';
import type { ZoneId } from '../data/types';

export function xpToNext(level: number): number {
  return Math.round(BALANCE.xp.base * Math.pow(level, BALANCE.xp.exponent));
}

/** Adds XP and returns the number of levels gained. */
export function addXp(state: GameState, amount: number): number {
  let gained = 0;
  state.xp += Math.max(0, Math.round(amount));
  while (state.level < BALANCE.xp.maxLevel && state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level += 1;
    gained += 1;
  }
  return gained;
}

export function collectionCount(state: GameState, zone?: ZoneId): number {
  const list = zone ? speciesOfZone(zone) : SPECIES;
  return list.filter((s) => state.dex[s.id]).length;
}

export function collectionTotal(zone?: ZoneId): number {
  return zone ? speciesOfZone(zone).length : SPECIES.length;
}

/** Collection completion in percent (0..100, not rounded). */
export function collectionPercent(state: GameState, zone?: ZoneId): number {
  return (collectionCount(state, zone) / collectionTotal(zone)) * 100;
}

/** One page of Maëlle's notebook is unlocked every 10 % of collection. */
export function journalPagesUnlocked(state: GameState): number {
  return Math.min(10, Math.floor((collectionPercent(state) + 1e-9) / 10));
}

export function claimableMilestones(state: GameState): number[] {
  const percent = collectionPercent(state) + 1e-9;
  return BALANCE.milestones
    .filter((m) => percent >= m.percent && !state.milestonesClaimed.includes(m.percent))
    .map((m) => m.percent);
}

export function variantsFound(state: GameState): number {
  return Object.values(state.dex).reduce((sum, e) => sum + e.variants.length, 0);
}
