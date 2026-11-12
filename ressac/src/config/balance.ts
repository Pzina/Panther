import type { DayPhase, Rarity, VariantId, Weather } from '../data/types';

/**
 * Every tunable number of the game lives here.
 * `npm run simulate` plays simulated careers against these values to check the progression curve.
 */
export const BALANCE = {
  clock: {
    /** Real minutes for one in-game day. */
    realMinutesPerDay: 24,
    daysPerSeason: 7,
    startHour: 7,
    /** Weather changes every N in-game hours. */
    weatherSlotHours: 3,
    /** Chance for a night slot to become a "marée luisante". */
    glowChance: 0.055,
  },
  phases: {
    dawn: [5, 8],
    day: [8, 18],
    dusk: [18, 21],
    night: [21, 5],
  } as Record<DayPhase, [number, number]>,
  rarity: {
    common: { weight: 100, value: 1, xp: 8, difficulty: 0.12, window: 1.0, luckScale: 0 },
    uncommon: { weight: 34, value: 2.4, xp: 18, difficulty: 0.28, window: 0.85, luckScale: 0.35 },
    rare: { weight: 11, value: 6, xp: 45, difficulty: 0.46, window: 0.7, luckScale: 0.8 },
    epic: { weight: 3.4, value: 15, xp: 110, difficulty: 0.64, window: 0.58, luckScale: 1.1 },
    legendary: { weight: 0.65, value: 40, xp: 280, difficulty: 0.82, window: 0.48, luckScale: 1.3 },
    mythic: { weight: 0.17, value: 110, xp: 750, difficulty: 1.0, window: 0.4, luckScale: 1.5 },
  } as Record<
    Rarity,
    { weight: number; value: number; xp: number; difficulty: number; window: number; luckScale: number }
  >,
  /** Base value (coins) of a common fish in the first zone. */
  baseFishValue: 7,
  variants: {
    normal: { chance: 0, value: 1, xp: 1 },
    albino: { chance: 0.022, value: 2, xp: 1.5 },
    melanic: { chance: 0.016, value: 2.5, xp: 1.5 },
    golden: { chance: 0.008, value: 5, xp: 2 },
    shimmer: { chance: 0.004, value: 8, xp: 3 },
  } as Record<VariantId, { chance: number; value: number; xp: number }>,
  fit: {
    /** Weight multipliers when a species' preference is not met. */
    wrongPhase: 0.12,
    wrongWeather: 0.4,
    wrongSeason: 0.45,
    /** Weight multiplier when the bait is one of the favourites. */
    favouriteBait: 2.4,
    depthTolerance: 0.04,
  },
  pity: {
    /** Extra weight per catch without a rare-or-better / legendary-or-better fish. */
    rareStep: 0.07,
    rareCap: 4,
    legendStep: 0.025,
    legendCap: 6,
  },
  cast: {
    /** Seconds for the power gauge to go from 0 to 1. */
    chargeSeconds: 0.9,
    /** Half-width of the "perfect" window around the sweet spot. */
    perfectWindow: 0.06,
    sweetSpot: 0.82,
    perfectLuck: 0.25,
  },
  bite: {
    minSeconds: 4,
    maxSeconds: 10,
    weather: { sun: 1.08, clouds: 1, rain: 0.86, storm: 0.76, fog: 0.95, glow: 0.8 } as Record<Weather, number>,
    phase: { dawn: 0.85, day: 1, dusk: 0.85, night: 0.95 } as Record<DayPhase, number>,
    perfectMult: 0.75,
    fakeBiteChance: 0.4,
    /** Hook-set window limits (seconds). */
    windowMin: 0.4,
    windowMax: 1.0,
    beginnerWindowBonus: 0.2,
  },
  fight: {
    baseSafeWidth: 0.36,
    difficultyNarrowing: 0.17,
    assistMult: 1.5,
    riseRate: 0.62,
    fallRate: 0.5,
    minSeconds: 3,
    maxSeconds: 30,
    /** Share of the fight a good player spends reeling inside the safe zone. */
    efficiency: 0.4,
    /** How much faster the fish comes in once the expected duration is over (per extra duration). */
    fatigue: 1.5,
    outsideReelFactor: 0.25,
    recoverRate: 0.025,
    strainRate: 0.55,
    strainExcess: 2.2,
    strainRecover: 0.4,
    slackRate: 0.42,
    slackExcess: 1.4,
    slackRecover: 0.5,
    jumpPenalty: 0.42,
    jumpBonus: 0.07,
  },
  xp: {
    /** XP needed to go from `level` to `level + 1`. */
    base: 45,
    exponent: 1.55,
    levelCoins: 30,
    maxLevel: 50,
  },
  reputation: {
    release: 2,
    perSale: 0.25,
    missionDefault: 6,
  },
  rest: {
    luck: 0.15,
    xpMult: 1.15,
    hours: 8,
  },
  offline: {
    minMinutes: 10,
    maxHours: 8,
    /** Coins per hour = rate x value multiplier of the best unlocked zone x boat tier. */
    coinsPerHour: 22,
  },
  dailyBonus: [
    { coins: 40 },
    { baits: { ver: 8 } },
    { coins: 90 },
    { baits: { crevette: 6 } },
    { coins: 160 },
    { baits: { strouille: 5 } },
    { coins: 320, baits: { lumignon: 3 } },
  ] as { coins?: number; baits?: Record<string, number> }[],
  milestones: [
    { percent: 10, coins: 100 },
    { percent: 25, coins: 400 },
    { percent: 50, coins: 1500 },
    { percent: 75, coins: 5000 },
    { percent: 100, coins: 20000 },
  ],
  sellBonusPerLevel: 0.01,
  aquariumSlots: 6,
  /** Seconds a simulated or real catch takes besides waiting and fighting (cast, card, etc.). */
  overheadSeconds: 10,
};

export type Balance = typeof BALANCE;
