import { BALANCE } from '../config/balance';
import type { GameState } from '../core/state';
import { getBait, getBoat, getHook, getLine, getReel, getRod } from '../data/equipment';

/** Everything the equipment and temporary bonuses change in the fishing rules. */
export interface PlayerStats {
  reach: number;
  luck: number;
  control: number;
  reelSpeed: number;
  smooth: number;
  lineStrength: number;
  hookWindow: number;
  hold: number;
  creelSize: number;
  travelMult: number;
  baitSpeed: number;
  rested: boolean;
  xpMult: number;
}

export function isRested(state: GameState): boolean {
  return state.clockMinutes < state.restUntil;
}

/** Bait actually used: falls back to the infinite one when the stock is empty. */
export function activeBaitId(state: GameState): string {
  const bait = getBait(state.equipment.bait);
  if (bait.infinite) return bait.id;
  return (state.baits[bait.id] ?? 0) > 0 ? bait.id : 'mie';
}

export function playerStats(state: GameState): PlayerStats {
  const rod = getRod(state.equipment.rod);
  const reel = getReel(state.equipment.reel);
  const line = getLine(state.equipment.line);
  const hook = getHook(state.equipment.hook);
  const boat = getBoat(state.equipment.boat);
  const bait = getBait(activeBaitId(state));
  const rested = isRested(state);
  return {
    reach: rod.reach,
    luck: rod.luck + bait.luck + (rested ? BALANCE.rest.luck : 0) + (state.level - 1) * 0.004,
    control: rod.control,
    reelSpeed: reel.speed,
    smooth: reel.smooth,
    lineStrength: line.strength,
    hookWindow: hook.window,
    hold: hook.hold,
    creelSize: boat.creel,
    travelMult: boat.travel,
    baitSpeed: bait.speed,
    rested,
    xpMult: rested ? BALANCE.rest.xpMult : 1,
  };
}
