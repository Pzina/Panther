import { BALANCE } from '../config/balance';
import { ACHIEVEMENTS } from '../data/achievements';
import { boatOfTier, getBait, getBoat, getCosmetic, getItem } from '../data/equipment';
import { CHALLENGES, STORY } from '../data/missions';
import { getSpecies, LEGEND_ID } from '../data/species';
import type {
  CaughtFish,
  DayPhase,
  Reward,
  Season,
  Species,
  StoryMission,
  Weather,
  ZoneId,
} from '../data/types';
import { getZone, ZONES } from '../data/zones';
import { canBuy, craftIngredients, sellPrice, type BuyCheck } from '../systems/economy';
import { buildFightParams, type FightParams } from '../systems/fight';
import {
  biteDelay,
  fishXp,
  hookWindow,
  nextPity,
  rarityRank,
  rollFish,
  rollSpecies,
  sizeNormOf,
  type FishingContext,
} from '../systems/fishing';
import {
  dailyDelta,
  generateDaily,
  isCounter,
  objectiveDelta,
  objectiveDone,
  objectiveProgress,
  objectiveTarget,
  type GameAction,
} from '../systems/missions';
import { addXp, claimableMilestones, collectionPercent, journalPagesUnlocked } from '../systems/progression';
import { activeBaitId, playerStats, type PlayerStats } from '../systems/stats';
import { weatherAt } from '../systems/weather';
import {
  dayOf,
  daysBetween,
  gameMinutesPerRealSecond,
  hourOf,
  minutesUntilPhase,
  phaseOf,
  realDateKey,
  seasonOf,
} from './clock';
import { Emitter } from './events';
import { Rng } from './rng';
import type { GameState } from './state';

export interface CatchResult {
  fish: CaughtFish;
  species: Species;
  isNew: boolean;
  recordSize: boolean;
  recordWeight: boolean;
  newVariant: boolean;
  xp: number;
  levelUps: number;
}

export interface BitePlan {
  species: Species;
  fish: CaughtFish;
  delay: number;
  window: number;
  fakeBites: number;
}

export type GameEvents = {
  change: undefined;
  toast: { text: string; kind?: 'info' | 'good' | 'warn'; icon?: string };
  levelUp: { level: number };
  achievement: { id: string };
  storyComplete: { mission: StoryMission };
  zoneUnlocked: { zone: ZoneId };
  journalPage: { page: number };
  milestone: { percent: number };
  ending: undefined;
};

/**
 * Rules of the game, independent from any rendering. Scenes, HTML screens, tests and the
 * balance simulation all go through this class.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly rng: Rng;
  /** Debug only: forces the weather everywhere. */
  debugWeather: Weather | null = null;
  private lastJournalPages: number;

  constructor(public state: GameState) {
    this.rng = new Rng(state.rngState);
    this.lastJournalPages = journalPagesUnlocked(state);
  }

  // ───────────────────────── Time & world ─────────────────────────

  /** Advances the in-game clock by a number of real seconds of play. */
  advance(realSeconds: number): void {
    this.state.clockMinutes += realSeconds * gameMinutesPerRealSecond();
    this.state.stats.playSeconds += realSeconds;
  }

  get day(): number {
    return dayOf(this.state.clockMinutes);
  }
  get hour(): number {
    return hourOf(this.state.clockMinutes);
  }
  get season(): Season {
    return seasonOf(this.state.clockMinutes);
  }
  /** Phase of the day as seen in a zone (the Fosse is always in the dark). */
  phase(zone: ZoneId = this.state.zone): DayPhase {
    return getZone(zone).permanentNight ? 'night' : phaseOf(this.state.clockMinutes);
  }
  weather(zone: ZoneId = this.state.zone): Weather {
    if (this.debugWeather) return this.debugWeather;
    return weatherAt(this.state.seed, zone, this.state.clockMinutes);
  }
  stats(): PlayerStats {
    return playerStats(this.state);
  }
  baitId(): string {
    return activeBaitId(this.state);
  }

  private touch(): void {
    this.state.rngState = this.rng.state;
    this.checkAchievements();
    this.checkJournal();
    this.events.emit('change', undefined);
  }

  // ───────────────────────── Fishing ─────────────────────────

  context(depth: number, extraLuck = 0): FishingContext {
    const stats = this.stats();
    return {
      zone: this.state.zone,
      depth,
      phase: this.phase(),
      weather: this.weather(),
      season: this.season,
      bait: this.baitId(),
      luck: stats.luck + extraLuck,
      pity: this.state.pity,
    };
  }

  /** Registers a cast. `power` is the gauge value (0..1); returns the reached depth. */
  registerCast(power: number, perfect: boolean): number {
    this.state.stats.casts += 1;
    if (perfect) {
      this.state.stats.perfectCasts += 1;
      this.applyAction({ type: 'perfect' });
    }
    this.touch();
    return Math.min(1, Math.max(0, power)) * this.stats().reach;
  }

  /** Decides what will bite, when, and how long the player has to react. */
  planBite(depth: number, perfect: boolean, opts: { luck?: number; delayMult?: number; force?: string } = {}): BitePlan {
    const stats = this.stats();
    const luck = (perfect ? BALANCE.cast.perfectLuck : 0) + (opts.luck ?? 0);
    const ctx = this.context(depth, luck);
    const species = opts.force ? getSpecies(opts.force) : rollSpecies(ctx, this.rng);
    const fish = rollFish(species, this.rng, ctx.luck, this.state.zone, this.day, this.state.nextUid++);
    const delay = biteDelay(
      {
        zone: this.state.zone,
        phase: ctx.phase,
        weather: ctx.weather,
        baitSpeed: stats.baitSpeed,
        perfect,
        bonus: opts.delayMult,
      },
      this.rng,
    );
    const fakeBites = this.rng.chance(BALANCE.bite.fakeBiteChance) ? this.rng.int(1, 2) : 0;
    this.state.rngState = this.rng.state;
    return { species, fish, delay, window: hookWindow(species, stats.hookWindow, this.state.zone), fakeBites };
  }

  private consumeBait(): void {
    const id = this.baitId();
    const bait = getBait(id);
    if (bait.infinite) return;
    const left = Math.max(0, (this.state.baits[id] ?? 0) - 1);
    this.state.baits[id] = left;
    if (left === 0) {
      this.events.emit('toast', { text: `Plus de « ${bait.name} » : retour à la mie de pain.`, kind: 'warn', icon: 'bait' });
    }
  }

  /** The fish took the bait and is hooked: the fight starts. */
  startFight(plan: BitePlan, forgiving = false): FightParams {
    this.consumeBait();
    const sizeNorm = sizeNormOf(plan.species, plan.fish.size);
    return buildFightParams(
      plan.species,
      sizeNorm,
      this.stats(),
      getZone(this.state.zone).gimmick,
      this.state.settings.assist,
      forgiving,
    );
  }

  failCatch(kind: 'missed' | 'snapped' | 'escaped'): void {
    const s = this.state.stats;
    if (kind === 'missed') {
      s.missedHooks += 1;
      this.consumeBait();
    } else if (kind === 'snapped') s.lineBreaks += 1;
    else s.escapes += 1;
    if (kind !== 'missed') s.streakNoBreak = 0;
    this.touch();
  }

  /** The fish is landed: collection, records, XP, missions. It is not stored anywhere yet. */
  completeCatch(fish: CaughtFish): CatchResult {
    const state = this.state;
    const species = getSpecies(fish.speciesId);
    const stats = state.stats;
    const phase = this.phase();
    const weather = this.weather();
    const entry = state.dex[species.id];
    const isNew = !entry;
    const recordSize = !entry || fish.size > entry.maxSize;
    const recordWeight = !entry || fish.weight > entry.maxWeight;
    const newVariant = fish.variant !== 'normal' && !(entry?.variants.includes(fish.variant) ?? false);
    if (!entry) {
      state.dex[species.id] = {
        count: 1,
        maxSize: fish.size,
        maxWeight: fish.weight,
        variants: fish.variant === 'normal' ? [] : [fish.variant],
        firstDay: this.day,
      };
    } else {
      entry.count += 1;
      entry.maxSize = Math.max(entry.maxSize, fish.size);
      entry.maxWeight = Math.max(entry.maxWeight, fish.weight);
      if (newVariant) entry.variants.push(fish.variant);
    }

    stats.catches += 1;
    stats.streakNoBreak += 1;
    stats.bestStreakNoBreak = Math.max(stats.bestStreakNoBreak, stats.streakNoBreak);
    const rank = rarityRank(species.rarity);
    if (rank >= rarityRank('rare')) stats.rareCatches += 1;
    if (rank >= rarityRank('epic')) stats.epicCatches += 1;
    if (rank >= rarityRank('legendary')) stats.legendaryCatches += 1;
    if (rank >= rarityRank('mythic')) stats.mythicCatches += 1;
    if (fish.variant !== 'normal') stats.variantCatches += 1;
    if (phase === 'night') stats.nightCatches += 1;
    if (phase === 'dawn') stats.dawnCatches += 1;
    if (weather === 'rain') stats.rainCatches += 1;
    if (weather === 'storm') stats.stormCatches += 1;
    if (weather === 'glow') stats.glowCatches += 1;
    stats.biggestCm = Math.max(stats.biggestCm, fish.size);
    stats.heaviestKg = Math.max(stats.heaviestKg, fish.weight);

    state.pity = nextPity(state.pity, species.rarity);

    const xp = Math.round(
      fishXp(species, sizeNormOf(species, fish.size), fish.variant, isNew) * this.stats().xpMult,
    );
    const levelUps = this.grantXp(xp);

    this.applyAction({
      type: 'catch',
      fish,
      rarity: species.rarity,
      zone: state.zone,
      phase,
      weather,
      variant: fish.variant,
    });
    this.touch();
    return { fish, species, isNew, recordSize, recordWeight, newVariant, xp, levelUps };
  }

  private grantXp(amount: number): number {
    const levelUps = addXp(this.state, amount);
    for (let i = 0; i < levelUps; i++) {
      this.state.coins += BALANCE.xp.levelCoins * (this.state.level - levelUps + i + 1);
      this.events.emit('levelUp', { level: this.state.level - levelUps + i + 1 });
    }
    return levelUps;
  }

  creelFull(): boolean {
    return this.state.creel.length >= this.stats().creelSize;
  }

  /** Puts the fish in the creel. Returns false when it is full. */
  keepFish(fish: CaughtFish): boolean {
    if (this.creelFull()) return false;
    this.state.creel.push(fish);
    this.touch();
    return true;
  }

  /** Lets a freshly caught fish (or one from the creel) go, for a little reputation. */
  releaseFish(fish: CaughtFish): void {
    this.state.creel = this.state.creel.filter((f) => f.uid !== fish.uid);
    this.state.stats.released += 1;
    this.state.reputation += BALANCE.reputation.release;
    this.applyAction({ type: 'release' });
    this.touch();
  }

  // ───────────────────────── Economy ─────────────────────────

  priceOf(fish: CaughtFish): number {
    return sellPrice(this.state, fish);
  }

  private sell(list: CaughtFish[]): number {
    if (list.length === 0) return 0;
    let coins = 0;
    for (const fish of list) {
      const price = this.priceOf(fish);
      coins += price;
      this.state.stats.bestSale = Math.max(this.state.stats.bestSale, price);
    }
    const uids = new Set(list.map((f) => f.uid));
    this.state.creel = this.state.creel.filter((f) => !uids.has(f.uid));
    this.state.coins += coins;
    this.state.stats.sold += list.length;
    this.state.stats.coinsEarned += coins;
    this.state.reputation += BALANCE.reputation.perSale * list.length;
    this.applyAction({ type: 'sell', count: list.length, coins });
    this.touch();
    return coins;
  }

  sellFish(uid: number): number {
    const fish = this.state.creel.find((f) => f.uid === uid);
    return fish ? this.sell([fish]) : 0;
  }

  /** Sells every unlocked fish of the creel. */
  sellAll(): number {
    return this.sell(this.state.creel.filter((f) => !f.locked));
  }

  toggleLock(uid: number): void {
    const fish = this.state.creel.find((f) => f.uid === uid);
    if (fish) fish.locked = !fish.locked;
    this.touch();
  }

  toAquarium(uid: number): boolean {
    const fish = this.state.creel.find((f) => f.uid === uid);
    if (!fish || this.state.aquarium.length >= BALANCE.aquariumSlots) return false;
    this.state.creel = this.state.creel.filter((f) => f.uid !== uid);
    this.state.aquarium.push({ ...fish, locked: false });
    this.touch();
    return true;
  }

  fromAquarium(uid: number): boolean {
    const fish = this.state.aquarium.find((f) => f.uid === uid);
    if (!fish || this.creelFull()) return false;
    this.state.aquarium = this.state.aquarium.filter((f) => f.uid !== uid);
    this.state.creel.push(fish);
    this.touch();
    return true;
  }

  checkBuy(itemId: string): BuyCheck {
    return canBuy(this.state, itemId);
  }

  buy(itemId: string): BuyCheck {
    const check = canBuy(this.state, itemId);
    if (!check.ok) return check;
    const item = getItem(itemId);
    this.state.coins -= item.price;
    this.state.stats.coinsSpent += item.price;
    this.state.stats.itemsBought += 1;
    if (item.category === 'bait') {
      this.state.baits[item.id] = (this.state.baits[item.id] ?? 0) + item.pack;
    } else {
      this.state.owned.push(item.id);
      this.equip(item.id);
    }
    this.checkStory();
    this.touch();
    return check;
  }

  equip(itemId: string): void {
    const item = getItem(itemId);
    if (item.category === 'bait') {
      if (item.infinite || (this.state.baits[item.id] ?? 0) > 0) this.state.equipment.bait = item.id;
    } else if (this.state.owned.includes(itemId)) {
      if (item.category === 'cosmetic') this.state.cosmetics[getCosmetic(itemId).slot] = itemId;
      else this.state.equipment[item.category] = itemId;
    }
    this.touch();
  }

  canCraft(baitId: string): boolean {
    const bait = getBait(baitId);
    if (!bait.craft) return false;
    if (bait.mission && !(this.state.story.finished || this.storyIndexOf(bait.mission) < this.state.story.index)) return false;
    return craftIngredients(this.state, bait) !== null;
  }

  private storyIndexOf(missionId: string): number {
    return STORY.findIndex((m) => m.id === missionId);
  }

  craft(baitId: string): boolean {
    if (!this.canCraft(baitId)) return false;
    const bait = getBait(baitId);
    const used = craftIngredients(this.state, bait)!;
    const uids = new Set(used.map((f) => f.uid));
    this.state.creel = this.state.creel.filter((f) => !uids.has(f.uid));
    this.state.baits[bait.id] = (this.state.baits[bait.id] ?? 0) + bait.pack;
    this.state.stats.crafted += 1;
    this.applyAction({ type: 'craft' });
    this.touch();
    return true;
  }

  // ───────────────────────── Travel & rest ─────────────────────────

  zoneAccess(zone: ZoneId): { ok: true } | { ok: false; reason: 'locked' | 'boat' } {
    if (!this.state.unlockedZones.includes(zone)) return { ok: false, reason: 'locked' };
    if (getBoat(this.state.equipment.boat).tier < getZone(zone).boatTier) return { ok: false, reason: 'boat' };
    return { ok: true };
  }

  travelMinutes(zone: ZoneId): number {
    return Math.round(getZone(zone).travelMinutes * this.stats().travelMult);
  }

  travel(zone: ZoneId): boolean {
    if (!this.zoneAccess(zone).ok) return false;
    if (zone !== this.state.zone) {
      this.state.clockMinutes += this.travelMinutes(zone);
      this.state.stats.travels += 1;
    }
    this.state.zone = zone;
    this.touch();
    return true;
  }

  canRest(): boolean {
    return this.state.lastRestDay < this.day || this.state.clockMinutes >= this.state.restUntil;
  }

  /** Sleeps in the cabin until the chosen phase and wakes up rested (luck and XP bonus). */
  rest(until: DayPhase): void {
    this.state.clockMinutes += minutesUntilPhase(this.state.clockMinutes, until);
    this.state.restUntil = this.state.clockMinutes + BALANCE.rest.hours * 60;
    this.state.lastRestDay = this.day;
    this.state.stats.rests += 1;
    this.touch();
  }

  // ───────────────────────── Missions ─────────────────────────

  currentStory(): StoryMission | undefined {
    return this.state.story.finished ? undefined : STORY[this.state.story.index];
  }

  storyProgress(): { value: number; target: number } {
    const mission = this.currentStory();
    if (!mission) return { value: 1, target: 1 };
    return {
      value: objectiveProgress(mission.objective, this.state, this.state.story.progress),
      target: objectiveTarget(mission.objective),
    };
  }

  private applyReward(reward: Reward): void {
    const state = this.state;
    if (reward.coins) state.coins += reward.coins;
    if (reward.reputation) state.reputation += reward.reputation;
    if (reward.baits) {
      for (const [id, count] of Object.entries(reward.baits)) state.baits[id] = (state.baits[id] ?? 0) + count;
    }
    if (reward.item && !state.owned.includes(reward.item)) state.owned.push(reward.item);
    if (reward.unlockZone && !state.unlockedZones.includes(reward.unlockZone)) {
      state.unlockedZones.push(reward.unlockZone);
      this.events.emit('zoneUnlocked', { zone: reward.unlockZone });
    }
    if (reward.xp) this.grantXp(reward.xp);
  }

  private applyAction(action: GameAction): void {
    const state = this.state;
    const mission = this.currentStory();
    if (mission && isCounter(mission.objective)) {
      state.story.progress += objectiveDelta(mission.objective, action);
    }
    for (const challenge of CHALLENGES) {
      if (!isCounter(challenge.objective)) continue;
      const delta = objectiveDelta(challenge.objective, action);
      if (delta === 0) continue;
      const entry = (state.challenges[challenge.id] ??= { progress: 0, claimed: false });
      if (!entry.claimed) entry.progress += delta;
    }
    this.ensureDaily();
    for (const daily of state.daily.missions) {
      if (!daily.claimed) daily.progress = Math.min(daily.target, daily.progress + dailyDelta(daily, action));
    }
    this.checkStory();
  }

  /** Completes the current story mission when its objective is met (possibly several in a row). */
  checkStory(): void {
    const state = this.state;
    let guard = 0;
    while (!state.story.finished && guard++ < STORY.length) {
      const mission = STORY[state.story.index];
      if (!mission || !objectiveDone(mission.objective, state, state.story.progress)) break;
      this.applyReward(mission.reward);
      state.story.index += 1;
      state.story.progress = 0;
      state.story.introSeen = false;
      this.events.emit('storyComplete', { mission });
      if (state.story.index >= STORY.length) {
        state.story.finished = true;
        this.events.emit('ending', undefined);
      }
    }
  }

  markStoryIntroSeen(): void {
    this.state.story.introSeen = true;
    this.touch();
  }

  challengeProgress(id: string): { value: number; target: number; claimed: boolean } {
    const challenge = CHALLENGES.find((c) => c.id === id)!;
    const entry = this.state.challenges[id];
    return {
      value: objectiveProgress(challenge.objective, this.state, entry?.progress ?? 0),
      target: objectiveTarget(challenge.objective),
      claimed: entry?.claimed ?? false,
    };
  }

  claimChallenge(id: string): boolean {
    const challenge = CHALLENGES.find((c) => c.id === id);
    if (!challenge) return false;
    const p = this.challengeProgress(id);
    if (p.claimed || p.value < p.target) return false;
    const entry = (this.state.challenges[id] ??= { progress: 0, claimed: false });
    entry.claimed = true;
    this.applyReward(challenge.reward);
    this.touch();
    return true;
  }

  /** Makes sure the daily missions belong to the current real day. */
  ensureDaily(now: number = Date.now()): void {
    const key = realDateKey(now);
    if (this.state.daily.date !== key) {
      this.state.daily = { date: key, missions: generateDaily(this.state, key) };
    }
  }

  claimDaily(index: number): boolean {
    this.ensureDaily();
    const mission = this.state.daily.missions[index];
    if (!mission || mission.claimed || mission.progress < mission.target) return false;
    mission.claimed = true;
    this.state.coins += mission.coins;
    this.state.reputation += 2;
    this.state.stats.dailiesDone += 1;
    this.touch();
    return true;
  }

  claimMilestone(percent: number): boolean {
    if (!claimableMilestones(this.state).includes(percent)) return false;
    const milestone = BALANCE.milestones.find((m) => m.percent === percent)!;
    this.state.milestonesClaimed.push(percent);
    this.state.coins += milestone.coins;
    this.events.emit('milestone', { percent });
    this.touch();
    return true;
  }

  private checkAchievements(): void {
    for (const achievement of ACHIEVEMENTS) {
      if (this.state.achievements[achievement.id]) continue;
      if (achievement.value(this.state) >= achievement.target) {
        this.state.achievements[achievement.id] = Date.now();
        this.events.emit('achievement', { id: achievement.id });
      }
    }
  }

  private checkJournal(): void {
    const pages = journalPagesUnlocked(this.state);
    if (pages > this.lastJournalPages) {
      this.lastJournalPages = pages;
      this.events.emit('journalPage', { page: pages });
    }
  }

  // ───────────────────────── Gentle retention ─────────────────────────

  /** Reward of the daily login bonus, or null when it was already taken today. */
  loginBonus(now: number = Date.now()): { day: number; reward: { coins?: number; baits?: Record<string, number> } } | null {
    const key = realDateKey(now);
    const login = this.state.login;
    if (login.lastDate === key) return null;
    const gap = login.lastDate ? daysBetween(login.lastDate, key) : 1;
    const streak = gap === 1 ? login.streak + 1 : 1;
    const day = ((streak - 1) % BALANCE.dailyBonus.length) + 1;
    return { day, reward: BALANCE.dailyBonus[day - 1]! };
  }

  claimLoginBonus(now: number = Date.now()): boolean {
    const bonus = this.loginBonus(now);
    if (!bonus) return false;
    const key = realDateKey(now);
    const login = this.state.login;
    const gap = login.lastDate ? daysBetween(login.lastDate, key) : 1;
    login.streak = gap === 1 ? login.streak + 1 : 1;
    login.lastDate = key;
    this.applyReward(bonus.reward);
    this.touch();
    return true;
  }

  /** Coins brought by "le filet à la traîne" while the game was closed (reduced, capped at 8 h). */
  offlineGains(now: number = Date.now()): { coins: number; hours: number } | null {
    const o = BALANCE.offline;
    const elapsedMinutes = (now - this.state.lastSeen) / 60000;
    if (!this.state.flags.tutorialDone || elapsedMinutes < o.minMinutes) return null;
    const hours = Math.min(o.maxHours, elapsedMinutes / 60);
    const best = Math.max(...this.state.unlockedZones.map((z) => getZone(z).valueMult));
    const coins = Math.round(hours * o.coinsPerHour * best);
    return coins > 0 ? { coins, hours } : null;
  }

  collectOffline(now: number = Date.now()): number {
    const gains = this.offlineGains(now);
    this.state.lastSeen = now;
    if (!gains) return 0;
    this.state.coins += gains.coins;
    this.touch();
    return gains.coins;
  }

  // ───────────────────────── Debug (enabled with ?debug=1) ─────────────────────────

  debugCoins(amount: number): void {
    this.state.coins += amount;
    this.touch();
  }

  debugUnlockAll(): void {
    const state = this.state;
    state.unlockedZones = ZONES.map((z) => z.id);
    for (const tier of [2, 3, 4]) {
      const boat = boatOfTier(tier);
      if (!state.owned.includes(boat.id)) state.owned.push(boat.id);
    }
    state.equipment.boat = boatOfTier(4).id;
    state.level = Math.max(state.level, 25);
    state.reputation = Math.max(state.reputation, 200);
    state.baits.leurre = Math.max(state.baits.leurre ?? 0, 5);
    this.checkStory();
    this.touch();
  }

  /** Completes the current story mission whatever its objective. */
  debugSkipMission(): void {
    const state = this.state;
    const mission = this.currentStory();
    if (!mission) return;
    this.applyReward(mission.reward);
    state.story.index += 1;
    state.story.progress = 0;
    state.story.introSeen = false;
    this.events.emit('storyComplete', { mission });
    if (state.story.index >= STORY.length) {
      state.story.finished = true;
      this.events.emit('ending', undefined);
    }
    this.checkStory();
    this.touch();
  }

  debugAdvanceHours(hours: number): void {
    this.state.clockMinutes += hours * 60;
    this.touch();
  }

  /** True once the legend of the Fosse has been caught. */
  legendCaught(): boolean {
    return Boolean(this.state.dex[LEGEND_ID]);
  }

  collection(): number {
    return collectionPercent(this.state);
  }
}
