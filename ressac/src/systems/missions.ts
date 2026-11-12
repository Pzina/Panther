import { hashSeed, Rng } from '../core/rng';
import type { DailyMission, GameState } from '../core/state';
import { getBoat } from '../data/equipment';
import { DAILY_TEMPLATES } from '../data/missions';
import type { CaughtFish, DayPhase, Objective, Rarity, VariantId, Weather, ZoneId } from '../data/types';
import { getZone } from '../data/zones';
import { rarityRank } from './fishing';
import { collectionCount } from './progression';

/** Things that happen in the game and can advance missions. */
export type GameAction =
  | { type: 'catch'; fish: CaughtFish; rarity: Rarity; zone: ZoneId; phase: DayPhase; weather: Weather; variant: VariantId }
  | { type: 'sell'; count: number; coins: number }
  | { type: 'release' }
  | { type: 'perfect' }
  | { type: 'craft' };

/** True when the objective needs its own counter (as opposed to being read from the state). */
export function isCounter(objective: Objective): boolean {
  switch (objective.kind) {
    case 'catch':
    case 'sell':
    case 'earn':
    case 'release':
    case 'perfect':
    case 'craft':
    case 'variant':
      return true;
    default:
      return false;
  }
}

/** How much an action adds to a counter objective. */
export function objectiveDelta(objective: Objective, action: GameAction): number {
  switch (objective.kind) {
    case 'catch': {
      if (action.type !== 'catch') return 0;
      if (objective.zone && action.zone !== objective.zone) return 0;
      if (objective.phase && action.phase !== objective.phase) return 0;
      if (objective.weather && action.weather !== objective.weather) return 0;
      if (objective.minRarity && rarityRank(action.rarity) < rarityRank(objective.minRarity)) return 0;
      return 1;
    }
    case 'variant':
      return action.type === 'catch' && action.variant !== 'normal' ? 1 : 0;
    case 'sell':
      return action.type === 'sell' ? action.count : 0;
    case 'earn':
      return action.type === 'sell' ? action.coins : 0;
    case 'release':
      return action.type === 'release' ? 1 : 0;
    case 'perfect':
      return action.type === 'perfect' ? 1 : 0;
    case 'craft':
      return action.type === 'craft' ? 1 : 0;
    default:
      return 0;
  }
}

export function objectiveTarget(objective: Objective): number {
  switch (objective.kind) {
    case 'boat':
      return objective.tier;
    case 'catchSpecies':
      return 1;
    default:
      return objective.n;
  }
}

/** Current progress of an objective (never above its target). */
export function objectiveProgress(objective: Objective, state: GameState, counter: number): number {
  const target = objectiveTarget(objective);
  let value: number;
  switch (objective.kind) {
    case 'own':
      value = state.owned.filter((id) => id.startsWith(prefixOf(objective.category))).length;
      break;
    case 'boat':
      value = getBoat(state.equipment.boat).tier;
      break;
    case 'dex':
      value = collectionCount(state, objective.zone);
      break;
    case 'catchSpecies':
      value = state.dex[objective.id] ? 1 : 0;
      break;
    case 'level':
      value = state.level;
      break;
    default:
      value = counter;
  }
  return Math.min(target, Math.max(0, value));
}

function prefixOf(category: string): string {
  switch (category) {
    case 'rod':
      return 'rod-';
    case 'reel':
      return 'reel-';
    case 'line':
      return 'line-';
    case 'hook':
      return 'hook-';
    case 'boat':
      return 'boat-';
    default:
      return `${category}-`;
  }
}

export function objectiveDone(objective: Objective, state: GameState, counter: number): boolean {
  return objectiveProgress(objective, state, counter) >= objectiveTarget(objective);
}

/** Three daily missions, identical for a given save and calendar day. */
export function generateDaily(state: GameState, dateKey: string): DailyMission[] {
  const rng = new Rng(hashSeed(state.seed, 'daily', dateKey));
  const templates = rng.shuffle(DAILY_TEMPLATES.filter((tpl) => state.level >= tpl.minLevel)).slice(0, 3);
  return templates.map((tpl) => {
    const tier = Math.min(tpl.targets.length - 1, rng.int(0, tpl.targets.length - 1));
    const levelScale = 1 + Math.floor(state.level / 6) * 0.5;
    const zone = tpl.kind === 'catchZone' ? rng.pick(state.unlockedZones) : undefined;
    const zoneScale = zone ? getZone(zone).valueMult : 1 + (state.unlockedZones.length - 1) * 0.8;
    const earnScale = tpl.kind === 'earn' ? zoneScale : 1;
    return {
      templateId: tpl.id,
      kind: tpl.kind,
      zone,
      target: Math.round(tpl.targets[tier]! * earnScale),
      progress: 0,
      coins: Math.round(tpl.coins[tier]! * levelScale * Math.max(1, zoneScale * 0.6)),
      claimed: false,
    };
  });
}

export function dailyDelta(mission: DailyMission, action: GameAction): number {
  switch (mission.kind) {
    case 'catch':
      return action.type === 'catch' ? 1 : 0;
    case 'catchZone':
      return action.type === 'catch' && action.zone === mission.zone ? 1 : 0;
    case 'rare':
      return action.type === 'catch' && rarityRank(action.rarity) >= rarityRank('rare') ? 1 : 0;
    case 'earn':
      return action.type === 'sell' ? action.coins : 0;
    case 'sell':
      return action.type === 'sell' ? action.count : 0;
    case 'perfect':
      return action.type === 'perfect' ? 1 : 0;
    case 'release':
      return action.type === 'release' ? 1 : 0;
    default:
      return 0;
  }
}

export function dailyText(mission: DailyMission): string {
  const tpl = DAILY_TEMPLATES.find((d) => d.id === mission.templateId);
  const text = tpl?.text ?? 'Attraper {n} poissons';
  return text.replace('{n}', String(mission.target)).replace('{zone}', mission.zone ? getZone(mission.zone).name : '');
}
