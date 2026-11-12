import { BALANCE } from '../config/balance';
import type { GameState } from '../core/state';
import { getItem } from '../data/equipment';
import { STORY } from '../data/missions';
import { getSpecies } from '../data/species';
import type { Bait, CaughtFish, Item, Rarity } from '../data/types';
import { rarityRank } from './fishing';

export function sellPrice(state: GameState, fish: CaughtFish): number {
  return Math.max(1, Math.round(fish.value * (1 + (state.level - 1) * BALANCE.sellBonusPerLevel)));
}

export function isOwned(state: GameState, itemId: string): boolean {
  return state.owned.includes(itemId);
}

export function missionDone(state: GameState, missionId: string): boolean {
  const index = STORY.findIndex((m) => m.id === missionId);
  return index >= 0 && (state.story.finished || state.story.index > index);
}

export type LockReason =
  | { kind: 'level'; value: number }
  | { kind: 'reputation'; value: number }
  | { kind: 'mission'; value: string };

/** Requirement that still hides an article, if any. */
export function lockReason(state: GameState, item: Item): LockReason | null {
  if (item.mission && !missionDone(state, item.mission)) return { kind: 'mission', value: item.mission };
  if (item.level && state.level < item.level) return { kind: 'level', value: item.level };
  if (item.reputation && state.reputation < item.reputation)
    return { kind: 'reputation', value: item.reputation };
  return null;
}

export type BuyCheck = { ok: true } | { ok: false; reason: 'owned' | 'locked' | 'coins' | 'craft' | 'order' };

export function canBuy(state: GameState, itemId: string): BuyCheck {
  const item = getItem(itemId);
  if (item.category === 'bait') {
    if (item.infinite || item.craft) return { ok: false, reason: 'craft' };
  } else if (isOwned(state, itemId)) {
    return { ok: false, reason: 'owned' };
  }
  if (lockReason(state, item)) return { ok: false, reason: 'locked' };
  if (item.category === 'boat') {
    const current = getItem(state.equipment.boat);
    if (current.category === 'boat' && item.tier !== current.tier + 1) return { ok: false, reason: 'order' };
  }
  if (state.coins < item.price) return { ok: false, reason: 'coins' };
  return { ok: true };
}

/** Fish of the creel that a recipe would consume (cheapest, unlocked, exact rarity first). */
export function craftIngredients(state: GameState, bait: Bait): CaughtFish[] | null {
  if (!bait.craft) return null;
  const minRank = rarityRank(bait.craft.rarity as Rarity);
  const candidates = state.creel
    .filter((f) => !f.locked && rarityRank(getSpecies(f.speciesId).rarity) >= minRank)
    .sort((a, b) => {
      const ra = rarityRank(getSpecies(a.speciesId).rarity);
      const rb = rarityRank(getSpecies(b.speciesId).rarity);
      return ra - rb || a.value - b.value;
    });
  if (candidates.length < bait.craft.count) return null;
  return candidates.slice(0, bait.craft.count);
}
