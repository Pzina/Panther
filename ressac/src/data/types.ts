export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export type ZoneId = 'anse' | 'etang' | 'riviere' | 'recif' | 'large' | 'fosse';
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export const DAY_PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];
export type Weather = 'sun' | 'clouds' | 'rain' | 'storm' | 'fog' | 'glow';
export const WEATHERS: Weather[] = ['sun', 'clouds', 'rain', 'storm', 'fog', 'glow'];
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export type Behavior = 'calm' | 'nervous' | 'diver' | 'jumper' | 'cunning';
export type VariantId = 'normal' | 'albino' | 'melanic' | 'golden' | 'shimmer';
export const VARIANTS: VariantId[] = ['albino', 'melanic', 'golden', 'shimmer'];

export type BodyShape = 'fusiform' | 'round' | 'eel' | 'flat' | 'deep' | 'torpedo' | 'puffer' | 'angler';
export type TailShape = 'fork' | 'round' | 'fan' | 'point' | 'lunate';
export type DorsalShape = 'none' | 'low' | 'tall' | 'spiny' | 'long' | 'sail';
export type PatternKind = 'plain' | 'stripes' | 'bands' | 'spots' | 'belly' | 'scales' | 'glow' | 'marble';
export type FishExtra = 'whiskers' | 'lure' | 'sword' | 'horn' | 'teeth' | 'crest' | 'wings';

export interface FishArt {
  body: BodyShape;
  /** Length / height ratio of the body (1.2 = stocky, 6 = snake-like). */
  len: number;
  tail: TailShape;
  dorsal: DorsalShape;
  pattern: PatternKind;
  /** Body, pattern / belly and fin colours. */
  c1: string;
  c2: string;
  c3: string;
  /** Relative eye size (1 = normal). */
  eye: number;
  extra?: FishExtra;
}

export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  zones: ZoneId[];
  /** Cast distance range (0 = at the boat, 1 = farthest / deepest). */
  depth: [number, number];
  phases: DayPhase[];
  weathers: Weather[];
  seasons: Season[];
  baits: string[];
  /** Size range in centimetres and weight range in kilograms. */
  size: [number, number];
  weight: [number, number];
  baseValue: number;
  behavior: Behavior;
  /** Hard conditions: the species never bites outside of them. */
  requires?: { weather?: Weather[]; phase?: DayPhase[] };
  art: FishArt;
  flavor: string;
}

export interface ZonePalette {
  waterTop: number;
  waterBottom: number;
  land: number;
  landDark: number;
  accent: number;
}

export type ZoneGimmick = 'beginner' | 'still' | 'current' | 'shoals' | 'swell' | 'darkness';

export interface Zone {
  id: ZoneId;
  name: string;
  short: string;
  description: string;
  gimmick: ZoneGimmick;
  gimmickText: string;
  /** Multiplier applied to fish values and to bite delays. */
  valueMult: number;
  biteMult: number;
  /** Travel time from the port, in in-game minutes (before boat bonus). */
  travelMinutes: number;
  boatTier: number;
  /** Story mission that opens the zone (undefined = open from the start). */
  unlockMission?: string;
  unlockText: string;
  freshwater: boolean;
  permanentNight: boolean;
  weatherWeights: Partial<Record<Weather, number>>;
  palette: ZonePalette;
  /** Position on the archipelago map (0..100). */
  map: { x: number; y: number };
  /** Root note (MIDI) and scale used by the generative music. */
  music: { root: number; scale: number[]; tempo: number };
}

export type ItemCategory = 'rod' | 'reel' | 'line' | 'hook' | 'bait' | 'boat' | 'cosmetic';
export type CosmeticSlot = 'boatColor' | 'bobber' | 'outfit';

export interface ItemBase {
  id: string;
  category: ItemCategory;
  name: string;
  description: string;
  price: number;
  /** Requirements to see the article as purchasable. */
  level?: number;
  reputation?: number;
  mission?: string;
}

export interface Rod extends ItemBase {
  category: 'rod';
  /** Maximum cast distance (0..1). */
  reach: number;
  luck: number;
  /** Bonus added to the safe zone width. */
  control: number;
}
export interface Reel extends ItemBase {
  category: 'reel';
  speed: number;
  /** Reduces how fast the tension climbs while reeling. */
  smooth: number;
}
export interface Line extends ItemBase {
  category: 'line';
  strength: number;
}
export interface Hook extends ItemBase {
  category: 'hook';
  /** Seconds added to the hook-set window. */
  window: number;
  hold: number;
}
export interface Bait extends ItemBase {
  category: 'bait';
  /** Number of baits per purchase / craft. */
  pack: number;
  /** Bite delay multiplier (lower = faster). */
  speed: number;
  luck: number;
  infinite?: boolean;
  /** Craft recipe: number of fish of a minimum rarity taken from the creel. */
  craft?: { count: number; rarity: Rarity };
  special?: boolean;
}
export interface Boat extends ItemBase {
  category: 'boat';
  tier: number;
  creel: number;
  /** Travel time multiplier. */
  travel: number;
}
export interface Cosmetic extends ItemBase {
  category: 'cosmetic';
  slot: CosmeticSlot;
  /** Main colour (hex) used by the renderers. */
  color: number;
  color2: number;
  style: string;
}
export type Item = Rod | Reel | Line | Hook | Bait | Boat | Cosmetic;

export type Objective =
  | { kind: 'catch'; n: number; zone?: ZoneId; phase?: DayPhase; minRarity?: Rarity; weather?: Weather }
  | { kind: 'sell'; n: number }
  | { kind: 'earn'; n: number }
  | { kind: 'release'; n: number }
  | { kind: 'perfect'; n: number }
  | { kind: 'craft'; n: number }
  | { kind: 'variant'; n: number }
  | { kind: 'own'; category: ItemCategory; n: number }
  | { kind: 'boat'; tier: number }
  | { kind: 'dex'; n: number; zone?: ZoneId }
  | { kind: 'catchSpecies'; id: string }
  | { kind: 'level'; n: number };

export interface Reward {
  coins?: number;
  xp?: number;
  reputation?: number;
  baits?: Record<string, number>;
  item?: string;
  unlockZone?: ZoneId;
}

export type CharacterId = 'herve' | 'jo' | 'nell' | 'maelle';

export interface DialogueLine {
  who: CharacterId;
  text: string;
}

export interface StoryMission {
  id: string;
  act: 1 | 2 | 3;
  title: string;
  description: string;
  objective: Objective;
  reward: Reward;
  intro: DialogueLine[];
  outro: DialogueLine[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  objective: Objective;
  reward: Reward;
}

export interface DailyTemplate {
  id: string;
  /** Text with {n} and {zone} placeholders. */
  text: string;
  kind: 'catch' | 'catchZone' | 'earn' | 'perfect' | 'release' | 'rare' | 'sell';
  targets: number[];
  coins: number[];
  minLevel: number;
}

export interface CaughtFish {
  uid: number;
  speciesId: string;
  size: number;
  weight: number;
  variant: VariantId;
  value: number;
  zone: ZoneId;
  day: number;
  locked: boolean;
}
