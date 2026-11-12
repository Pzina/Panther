import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { getSpecies, LEGEND_ID, SPECIES } from '../data/species';
import type {
  CaughtFish,
  DayPhase,
  Rarity,
  Season,
  Species,
  VariantId,
  Weather,
  ZoneId,
} from '../data/types';
import { RARITIES, VARIANTS } from '../data/types';
import { getZone } from '../data/zones';

export interface FishingContext {
  zone: ZoneId;
  /** Cast distance, 0..1. */
  depth: number;
  phase: DayPhase;
  weather: Weather;
  season: Season;
  bait: string;
  luck: number;
  pity: { rare: number; legend: number };
}

export interface TableEntry {
  species: Species;
  weight: number;
}

export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

function meetsRequirements(species: Species, ctx: FishingContext): boolean {
  const tol = BALANCE.fit.depthTolerance;
  if (ctx.depth < species.depth[0] - tol || ctx.depth > species.depth[1] + tol) return false;
  if (species.requires?.weather && !species.requires.weather.includes(ctx.weather)) return false;
  if (species.requires?.phase && !species.requires.phase.includes(ctx.phase)) return false;
  // The legend only answers Maëlle's lure (handled by `rollSpecies`).
  if (species.id === LEGEND_ID && ctx.bait !== 'leurre') return false;
  return true;
}

/** Weighted probability table of the species that can bite in the given conditions. */
export function catchTable(ctx: FishingContext): TableEntry[] {
  const fit = BALANCE.fit;
  const entries: TableEntry[] = [];
  for (const species of SPECIES) {
    if (!species.zones.includes(ctx.zone) || !meetsRequirements(species, ctx)) continue;
    const r = BALANCE.rarity[species.rarity];
    let weight = r.weight;
    if (!species.phases.includes(ctx.phase)) weight *= fit.wrongPhase;
    if (!species.weathers.includes(ctx.weather)) weight *= fit.wrongWeather;
    if (!species.seasons.includes(ctx.season)) weight *= fit.wrongSeason;
    if (species.baits.includes(ctx.bait)) weight *= fit.favouriteBait;
    weight *= 1 + Math.max(0, ctx.luck) * r.luckScale * 2;
    const rank = rarityRank(species.rarity);
    if (rank >= rarityRank('rare')) {
      weight *= Math.min(BALANCE.pity.rareCap, 1 + ctx.pity.rare * BALANCE.pity.rareStep);
    }
    if (rank >= rarityRank('legendary')) {
      weight *= Math.min(BALANCE.pity.legendCap, 1 + ctx.pity.legend * BALANCE.pity.legendStep);
    }
    // Special weather species are the stars of the event.
    if (species.requires?.weather?.length === 1 && species.requires.weather[0] === 'glow') weight *= 6;
    entries.push({ species, weight });
  }
  return entries;
}

/** Probability (0..1) of each species in the current table. */
export function catchOdds(ctx: FishingContext): { species: Species; chance: number }[] {
  const table = catchTable(ctx);
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  return table.map((e) => ({ species: e.species, chance: total > 0 ? e.weight / total : 0 }));
}

export function rollSpecies(ctx: FishingContext, rng: Rng): Species {
  // Maëlle's lure, cast far into the Fosse, always calls the legend.
  if (ctx.bait === 'leurre' && ctx.zone === 'fosse') {
    const legend = getSpecies(LEGEND_ID);
    if (ctx.depth >= legend.depth[0] - BALANCE.fit.depthTolerance) return legend;
  }
  const table = catchTable(ctx);
  const picked = rng.weighted(table.map((e) => ({ item: e.species, weight: e.weight })));
  if (picked) return picked;
  // Should never happen (every zone has shallow commons), but never leave the player without a fish.
  return SPECIES.find((s) => s.zones.includes(ctx.zone) && s.rarity === 'common') ?? SPECIES[0]!;
}

export function nextPity(
  pity: { rare: number; legend: number },
  rarity: Rarity,
): { rare: number; legend: number } {
  const rank = rarityRank(rarity);
  return {
    rare: rank >= rarityRank('rare') ? 0 : pity.rare + 1,
    legend: rank >= rarityRank('legendary') ? 0 : pity.legend + 1,
  };
}

export interface BiteOptions {
  zone: ZoneId;
  phase: DayPhase;
  weather: Weather;
  baitSpeed: number;
  perfect: boolean;
  /** Extra multiplier from zone gimmicks (shoal, still water…). */
  bonus?: number;
}

/** Seconds between the bobber landing and the bite. */
export function biteDelay(o: BiteOptions, rng: Rng): number {
  const b = BALANCE.bite;
  let seconds = rng.range(b.minSeconds, b.maxSeconds);
  seconds *= getZone(o.zone).biteMult * b.weather[o.weather] * b.phase[o.phase] * o.baitSpeed;
  if (o.perfect) seconds *= b.perfectMult;
  seconds *= o.bonus ?? 1;
  return Math.max(1.2, seconds);
}

/** Hook-set window in seconds for a species. */
export function hookWindow(species: Species, hookBonus: number, zone: ZoneId): number {
  const b = BALANCE.bite;
  let window = BALANCE.rarity[species.rarity].window + hookBonus;
  if (getZone(zone).gimmick === 'beginner') window += b.beginnerWindowBonus;
  return Math.min(b.windowMax, Math.max(b.windowMin, window));
}

export function rollVariant(rng: Rng, luck: number): VariantId {
  const roll = rng.next();
  let acc = 0;
  // Rarest first so that luck never hides them.
  for (const id of [...VARIANTS].reverse()) {
    acc += BALANCE.variants[id].chance * (1 + Math.max(0, luck));
    if (roll < acc) return id;
  }
  return 'normal';
}

export function fishValue(species: Species, sizeNorm: number, variant: VariantId): number {
  return Math.max(
    1,
    Math.round(species.baseValue * (0.7 + 0.7 * sizeNorm) * BALANCE.variants[variant].value),
  );
}

export function fishXp(species: Species, sizeNorm: number, variant: VariantId, isNew: boolean): number {
  const base = BALANCE.rarity[species.rarity].xp * (0.85 + 0.3 * sizeNorm) * BALANCE.variants[variant].xp;
  return Math.round(base * (isNew ? 2 : 1));
}

export function sizeNormOf(species: Species, size: number): number {
  const [min, max] = species.size;
  return max > min ? Math.min(1, Math.max(0, (size - min) / (max - min))) : 0.5;
}

/** Rolls the individual fish: size (small ones are more common), weight, variant and value. */
export function rollFish(
  species: Species,
  rng: Rng,
  luck: number,
  zone: ZoneId,
  day: number,
  uid: number,
): CaughtFish {
  const sizeNorm = Math.pow(rng.next(), 1.7 - Math.min(0.6, Math.max(0, luck)));
  const size = species.size[0] + (species.size[1] - species.size[0]) * sizeNorm;
  const weightNorm = Math.pow(sizeNorm, 2.2) * rng.range(0.9, 1.1);
  const weight = species.weight[0] + (species.weight[1] - species.weight[0]) * Math.min(1, weightNorm);
  const variant = rollVariant(rng, luck);
  return {
    uid,
    speciesId: species.id,
    size: Math.round(size * 10) / 10,
    weight: Math.round(weight * 1000) / 1000,
    variant,
    value: fishValue(species, sizeNorm, variant),
    zone,
    day,
    locked: false,
  };
}
