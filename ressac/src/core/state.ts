import { BALANCE } from '../config/balance';
import { SAVE_VERSION } from '../config/constants';
import { DEFAULT_COSMETICS, DEFAULT_EQUIPMENT } from '../data/equipment';
import type { CaughtFish, CosmeticSlot, VariantId, ZoneId } from '../data/types';

export interface DexEntry {
  count: number;
  maxSize: number;
  maxWeight: number;
  variants: VariantId[];
  firstDay: number;
}

export interface Stats {
  casts: number;
  perfectCasts: number;
  catches: number;
  lineBreaks: number;
  escapes: number;
  missedHooks: number;
  released: number;
  sold: number;
  coinsEarned: number;
  coinsSpent: number;
  bestSale: number;
  rareCatches: number;
  epicCatches: number;
  legendaryCatches: number;
  mythicCatches: number;
  variantCatches: number;
  nightCatches: number;
  dawnCatches: number;
  rainCatches: number;
  stormCatches: number;
  glowCatches: number;
  biggestCm: number;
  heaviestKg: number;
  travels: number;
  crafted: number;
  rests: number;
  dailiesDone: number;
  playSeconds: number;
  streakNoBreak: number;
  bestStreakNoBreak: number;
  itemsBought: number;
}

export interface DailyMission {
  templateId: string;
  kind: string;
  zone?: ZoneId;
  target: number;
  progress: number;
  coins: number;
  claimed: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  ambience: number;
  vibration: boolean;
  leftHanded: boolean;
  textScale: number;
  colorblind: boolean;
  reducedMotion: boolean;
  assist: boolean;
  /** Camera: third person (the character is visible) or first person. */
  thirdPerson: boolean;
  lang: string;
}

export interface GameState {
  saveVersion: number;
  createdAt: number;
  updatedAt: number;
  /** Seed of the world (weather) and running state of the gameplay RNG. */
  seed: number;
  rngState: number;
  coins: number;
  xp: number;
  level: number;
  reputation: number;
  /** In-game minutes elapsed since day 1, 00:00. */
  clockMinutes: number;
  zone: ZoneId;
  unlockedZones: ZoneId[];
  equipment: { rod: string; reel: string; line: string; hook: string; bait: string; boat: string };
  owned: string[];
  baits: Record<string, number>;
  cosmetics: Record<CosmeticSlot, string>;
  creel: CaughtFish[];
  aquarium: CaughtFish[];
  nextUid: number;
  dex: Record<string, DexEntry>;
  pity: { rare: number; legend: number };
  story: { index: number; progress: number; introSeen: boolean; finished: boolean };
  challenges: Record<string, { progress: number; claimed: boolean }>;
  daily: { date: string; missions: DailyMission[] };
  achievements: Record<string, number>;
  milestonesClaimed: number[];
  journalPagesRead: number;
  stats: Stats;
  login: { lastDate: string; streak: number };
  lastSeen: number;
  restUntil: number;
  lastRestDay: number;
  flags: {
    introSeen: boolean;
    tutorialStep: number;
    tutorialDone: boolean;
    endingSeen: boolean;
    debug: boolean;
  };
  settings: Settings;
}

export function defaultSettings(): Settings {
  return {
    music: 0.6,
    sfx: 0.8,
    ambience: 0.5,
    vibration: true,
    leftHanded: false,
    textScale: 1,
    colorblind: false,
    reducedMotion: false,
    assist: false,
    thirdPerson: true,
    lang: 'fr',
  };
}

export function defaultStats(): Stats {
  return {
    casts: 0,
    perfectCasts: 0,
    catches: 0,
    lineBreaks: 0,
    escapes: 0,
    missedHooks: 0,
    released: 0,
    sold: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    bestSale: 0,
    rareCatches: 0,
    epicCatches: 0,
    legendaryCatches: 0,
    mythicCatches: 0,
    variantCatches: 0,
    nightCatches: 0,
    dawnCatches: 0,
    rainCatches: 0,
    stormCatches: 0,
    glowCatches: 0,
    biggestCm: 0,
    heaviestKg: 0,
    travels: 0,
    crafted: 0,
    rests: 0,
    dailiesDone: 0,
    playSeconds: 0,
    streakNoBreak: 0,
    bestStreakNoBreak: 0,
    itemsBought: 0,
  };
}

export function createNewState(seed: number, now: number = Date.now()): GameState {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    seed,
    rngState: seed,
    coins: 0,
    xp: 0,
    level: 1,
    reputation: 0,
    clockMinutes: BALANCE.clock.startHour * 60,
    zone: 'anse',
    unlockedZones: ['anse'],
    equipment: { ...DEFAULT_EQUIPMENT },
    owned: [...Object.values(DEFAULT_EQUIPMENT), ...Object.values(DEFAULT_COSMETICS)],
    baits: {},
    cosmetics: { ...DEFAULT_COSMETICS },
    creel: [],
    aquarium: [],
    nextUid: 1,
    dex: {},
    pity: { rare: 0, legend: 0 },
    story: { index: 0, progress: 0, introSeen: false, finished: false },
    challenges: {},
    daily: { date: '', missions: [] },
    achievements: {},
    milestonesClaimed: [],
    journalPagesRead: 0,
    stats: defaultStats(),
    login: { lastDate: '', streak: 0 },
    lastSeen: now,
    restUntil: 0,
    lastRestDay: 0,
    flags: { introSeen: false, tutorialStep: 0, tutorialDone: false, endingSeen: false, debug: false },
    settings: defaultSettings(),
  };
}
