import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import type { Behavior, Species, ZoneGimmick } from '../data/types';
import type { PlayerStats } from './stats';

export type FightStatus = 'active' | 'caught' | 'snapped' | 'escaped';

export interface FightParams {
  behavior: Behavior;
  /** 0 (trivial) .. 1 (legend). */
  difficulty: number;
  safeWidth: number;
  reelSpeed: number;
  smooth: number;
  lineStrength: number;
  hold: number;
  gimmick: ZoneGimmick;
  /** Tutorial fights cannot be lost. */
  forgiving: boolean;
}

/** Difficulty of a species: rarity first, nudged by how big the individual is. */
export function fightDifficulty(species: Species, sizeNorm: number): number {
  const base = BALANCE.rarity[species.rarity].difficulty;
  return Math.min(1, Math.max(0.05, base + (sizeNorm - 0.5) * 0.08));
}

export function fightDuration(difficulty: number): number {
  const f = BALANCE.fight;
  return f.minSeconds + (f.maxSeconds - f.minSeconds) * Math.pow(difficulty, 1.5);
}

export function buildFightParams(
  species: Species,
  sizeNorm: number,
  stats: PlayerStats,
  gimmick: ZoneGimmick,
  assist: boolean,
  forgiving = false,
): FightParams {
  const f = BALANCE.fight;
  const difficulty = fightDifficulty(species, sizeNorm);
  let safeWidth = f.baseSafeWidth - f.difficultyNarrowing * difficulty + stats.control;
  if (assist) safeWidth *= f.assistMult;
  if (forgiving) safeWidth = Math.max(safeWidth, 0.5);
  return {
    behavior: species.behavior,
    difficulty,
    safeWidth: Math.min(0.7, Math.max(0.14, safeWidth)),
    reelSpeed: stats.reelSpeed,
    smooth: stats.smooth,
    lineStrength: stats.lineStrength,
    hold: stats.hold,
    gimmick,
    forgiving,
  };
}

/**
 * Tension mini-game, independent from rendering.
 * Call `update(dt, reeling)` every frame and read the public fields to draw the gauge.
 */
export class FightModel {
  tension = 0.4;
  safeCenter = 0.5;
  /** Remaining distance, 1 → 0. */
  distance = 1;
  /** 0..1 — the line snaps at 1. */
  strain = 0;
  /** 0..1 — the fish unhooks at 1. */
  slack = 0;
  time = 0;
  status: FightStatus = 'active';
  /** Seconds before the announced jump (jumper), 0 when none is pending. */
  jumpWarning = 0;
  jumping = 0;
  /** Diver surge in progress (seconds left). */
  surge = 0;
  /** Number of safe-zone flips so far (cunning) — lets the view play a cue. */
  flips = 0;
  jerks = 0;

  private targetCenter = 0.5;
  private nextEvent: number;
  private phase: number;
  private reelRate: number;
  private expected: number;

  constructor(
    readonly params: FightParams,
    private rng: Rng,
  ) {
    const f = BALANCE.fight;
    this.expected = fightDuration(params.difficulty);
    this.reelRate = 1 / (this.expected * f.efficiency);
    this.nextEvent = rng.range(1.2, 2.4);
    this.phase = rng.range(0, Math.PI * 2);
  }

  get safeLow(): number {
    return Math.max(0, this.safeCenter - this.params.safeWidth / 2);
  }
  get safeHigh(): number {
    return Math.min(1, this.safeCenter + this.params.safeWidth / 2);
  }
  get inSafeZone(): boolean {
    return this.tension >= this.safeLow && this.tension <= this.safeHigh;
  }

  private scheduleEvent(min: number, max: number): void {
    const calmness = 1.3 - this.params.difficulty * 0.6;
    this.nextEvent = this.time + this.rng.range(min, max) * calmness;
  }

  private behave(dt: number): void {
    const p = this.params;
    const d = p.difficulty;
    const half = p.safeWidth / 2;
    const lo = half + 0.04;
    const hi = 1 - half - 0.04;
    switch (p.behavior) {
      case 'calm': {
        this.targetCenter = 0.5 + Math.sin(this.time * (0.5 + d) + this.phase) * (0.1 + 0.12 * d);
        break;
      }
      case 'nervous': {
        this.targetCenter = 0.5 + Math.sin(this.time * 0.9 + this.phase) * 0.12;
        if (this.time >= this.nextEvent) {
          // Sudden head shake: the tension jumps and the zone moves.
          this.tension += this.rng.range(0.1, 0.18) * (0.7 + d) * (this.rng.chance(0.75) ? 1 : -1);
          this.targetCenter = this.rng.range(lo, hi);
          this.jerks += 1;
          this.scheduleEvent(0.9, 2.2);
        }
        break;
      }
      case 'diver': {
        if (this.surge > 0) {
          this.surge -= dt;
          // The fish pulls: the line tightens and it gains ground, unless the player gives line.
          this.tension += (0.16 + 0.18 * d) * dt;
          this.distance = Math.min(1, this.distance + 0.03 * dt);
          this.targetCenter = Math.max(lo, 0.36 - 0.08 * d);
        } else {
          this.targetCenter = 0.5 + Math.sin(this.time * 0.6 + this.phase) * 0.1;
          if (this.time >= this.nextEvent) {
            this.surge = this.rng.range(1.2, 2.4);
            this.scheduleEvent(3.4, 5.5);
          }
        }
        break;
      }
      case 'jumper': {
        this.targetCenter = 0.52 + Math.sin(this.time * 0.8 + this.phase) * 0.12;
        if (this.jumping > 0) {
          this.jumping -= dt;
        } else if (this.jumpWarning > 0) {
          this.jumpWarning -= dt;
          if (this.jumpWarning <= 0) {
            this.jumpWarning = 0;
            this.jumping = 0.45;
            this.jumpResolved = false;
          }
        } else if (this.time >= this.nextEvent) {
          this.jumpWarning = 0.9 - 0.25 * d;
          this.scheduleEvent(3.6, 6);
        }
        break;
      }
      case 'cunning': {
        this.targetCenter += Math.sin(this.time * 1.3 + this.phase) * 0.12 * dt;
        if (this.time >= this.nextEvent) {
          // Changes direction: the safe zone flips to the other side of the gauge.
          this.targetCenter = 1 - this.targetCenter + this.rng.range(-0.06, 0.06);
          if (Math.abs(this.targetCenter - 0.5) < 0.12) this.targetCenter = this.rng.chance(0.5) ? lo + 0.05 : hi - 0.05;
          this.flips += 1;
          this.scheduleEvent(2.6, 4.6);
        }
        break;
      }
    }
    this.targetCenter = Math.min(hi, Math.max(lo, this.targetCenter));
  }

  private jumpResolved = true;

  update(dt: number, reeling: boolean): void {
    if (this.status !== 'active') return;
    const f = BALANCE.fight;
    const p = this.params;
    this.time += dt;

    this.behave(dt);
    const follow = 1.6 + p.difficulty * 2.2;
    this.safeCenter += (this.targetCenter - this.safeCenter) * Math.min(1, follow * dt);

    // Player input.
    if (reeling) this.tension += f.riseRate * (1 + 0.35 * p.difficulty) * (1 - p.smooth) * dt;
    else this.tension -= f.fallRate * dt;
    // Zone gimmick: the swell lifts and drops the line.
    if (p.gimmick === 'swell') this.tension += Math.sin(this.time * 1.7) * 0.16 * dt;
    if (p.gimmick === 'current') this.tension += 0.05 * dt;
    this.tension = Math.min(1, Math.max(0, this.tension));

    // Jump: reeling while the fish is in the air shocks the line, giving slack is rewarded.
    if (this.jumping > 0 && !this.jumpResolved) {
      this.jumpResolved = true;
      if (reeling) this.strain += f.jumpPenalty / p.lineStrength;
      else this.distance = Math.max(0, this.distance - f.jumpBonus);
    }

    // Progress.
    const inSafe = this.inSafeZone;
    if (reeling) {
      // A long fight tires the fish: progress speeds up once the expected duration is over.
      const fatigue = 1 + Math.max(0, this.time - this.expected) / this.expected * f.fatigue;
      this.distance -= this.reelRate * p.reelSpeed * fatigue * (inSafe ? 1 : f.outsideReelFactor) * dt;
    } else {
      this.distance = Math.min(1, this.distance + f.recoverRate * dt);
    }

    // Strain (too tight) and slack (too loose).
    if (this.tension > this.safeHigh) {
      this.strain += ((f.strainRate + f.strainExcess * (this.tension - this.safeHigh)) * dt) / p.lineStrength;
    } else {
      this.strain = Math.max(0, this.strain - f.strainRecover * dt);
    }
    if (this.tension < this.safeLow) {
      this.slack += ((f.slackRate + f.slackExcess * (this.safeLow - this.tension)) * dt) / p.hold;
    } else {
      this.slack = Math.max(0, this.slack - f.slackRecover * dt);
    }

    if (p.forgiving) {
      this.strain = Math.min(this.strain, 0.9);
      this.slack = Math.min(this.slack, 0.9);
    }

    if (this.distance <= 0) {
      this.distance = 0;
      this.status = 'caught';
    } else if (this.strain >= 1) {
      this.status = 'snapped';
    } else if (this.slack >= 1) {
      this.status = 'escaped';
    }
  }
}

/**
 * Plays a fight with a simple "human-like" controller. Used by the simulation and the tests.
 * `skill` in 0..1 controls reaction delay and attention.
 */
export function autoFight(
  params: FightParams,
  rng: Rng,
  skill = 0.7,
  dt = 1 / 30,
): { status: FightStatus; seconds: number } {
  const model = new FightModel(params, rng);
  const delay = 0.32 - 0.22 * skill;
  let reeling = false;
  let pending = false;
  let switchAt = 0;
  let guard = 0;
  while (model.status === 'active' && guard++ < 6000) {
    let want = model.tension < model.safeCenter;
    if (model.jumpWarning > 0 && model.jumpWarning < 0.35) want = false;
    if (model.jumping > 0) want = false;
    if (want !== reeling && !pending) {
      pending = true;
      switchAt = model.time + delay * rng.range(0.6, 1.5);
    }
    if (pending && model.time >= switchAt) {
      // An inattentive player sometimes misses the switch.
      if (rng.chance(0.82 + 0.17 * skill)) reeling = want;
      pending = false;
    }
    model.update(dt, reeling);
  }
  return { status: model.status === 'active' ? 'escaped' : model.status, seconds: model.time };
}
