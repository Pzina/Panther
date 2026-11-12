import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { getSpecies, SPECIES } from '../src/data/species';
import {
  catchOdds,
  catchTable,
  fishValue,
  hookWindow,
  nextPity,
  rarityRank,
  rollFish,
  rollSpecies,
  rollVariant,
  type FishingContext,
} from '../src/systems/fishing';

function ctx(over: Partial<FishingContext> = {}): FishingContext {
  return {
    zone: 'anse',
    depth: 0.3,
    phase: 'day',
    weather: 'sun',
    season: 'spring',
    bait: 'mie',
    luck: 0,
    pity: { rare: 0, legend: 0 },
    ...over,
  };
}

function rareShare(c: FishingContext): number {
  return catchOdds(c)
    .filter((o) => rarityRank(o.species.rarity) >= rarityRank('rare'))
    .reduce((sum, o) => sum + o.chance, 0);
}

describe('catch table', () => {
  it('only lists species of the zone that live at the cast depth', () => {
    const table = catchTable(ctx({ depth: 0.1 }));
    expect(table.length).toBeGreaterThan(0);
    for (const entry of table) {
      expect(entry.species.zones).toContain('anse');
      expect(entry.species.depth[0]).toBeLessThanOrEqual(0.1 + BALANCE.fit.depthTolerance);
    }
    expect(table.some((e) => e.species.id === 'congre')).toBe(false);
    expect(catchTable(ctx({ depth: 0.9, phase: 'night' })).some((e) => e.species.id === 'congre')).toBe(true);
  });

  it('gives every zone something to catch right next to the boat', () => {
    for (const zone of ['anse', 'etang', 'riviere', 'recif', 'large', 'fosse'] as const) {
      expect(catchTable(ctx({ zone, depth: 0.05 })).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('favours preferred baits, hours and weather', () => {
    const chance = (c: FishingContext, id: string) => catchOdds(c).find((o) => o.species.id === id)?.chance ?? 0;
    expect(chance(ctx({ depth: 0.6, bait: 'crevette' }), 'vieille')).toBeGreaterThan(chance(ctx({ depth: 0.6 }), 'vieille'));
    expect(chance(ctx({ depth: 0.8, phase: 'night' }), 'congre')).toBeGreaterThan(chance(ctx({ depth: 0.8 }), 'congre'));
    expect(chance(ctx({ depth: 0.6, weather: 'rain', phase: 'dusk' }), 'bar')).toBeGreaterThan(
      chance(ctx({ depth: 0.6, weather: 'sun', phase: 'dusk' }), 'bar'),
    );
  });

  it('enforces hard requirements', () => {
    const has = (c: FishingContext, id: string) => catchTable(c).some((e) => e.species.id === id);
    expect(has(ctx({ depth: 0.6, weather: 'sun' }), 'galet-vivant')).toBe(false);
    expect(has(ctx({ depth: 0.6, weather: 'fog' }), 'galet-vivant')).toBe(true);
    expect(has(ctx({ depth: 0.5, weather: 'sun' }), 'lueur')).toBe(false);
    expect(has(ctx({ depth: 0.5, weather: 'glow', phase: 'night' }), 'lueur')).toBe(true);
    expect(has(ctx({ zone: 'etang', depth: 0.6, phase: 'day' }), 'carpe-lune')).toBe(false);
    expect(has(ctx({ zone: 'etang', depth: 0.6, phase: 'night' }), 'carpe-lune')).toBe(true);
  });

  it('raises rare odds with luck and with the pity counter', () => {
    const base = rareShare(ctx({ depth: 0.7 }));
    expect(rareShare(ctx({ depth: 0.7, luck: 0.5 }))).toBeGreaterThan(base);
    const pity10 = rareShare(ctx({ depth: 0.7, pity: { rare: 10, legend: 10 } }));
    const pity30 = rareShare(ctx({ depth: 0.7, pity: { rare: 30, legend: 30 } }));
    expect(pity10).toBeGreaterThan(base);
    expect(pity30).toBeGreaterThan(pity10);
  });

  it('resets the pity counters on the right rarities', () => {
    expect(nextPity({ rare: 4, legend: 9 }, 'common')).toEqual({ rare: 5, legend: 10 });
    expect(nextPity({ rare: 4, legend: 9 }, 'rare')).toEqual({ rare: 0, legend: 10 });
    expect(nextPity({ rare: 4, legend: 9 }, 'mythic')).toEqual({ rare: 0, legend: 0 });
  });

  it('makes every species obtainable in some condition', () => {
    for (const species of SPECIES) {
      const found = species.zones.some((zone) =>
        (['dawn', 'day', 'dusk', 'night'] as const).some((phase) =>
          (['sun', 'clouds', 'rain', 'storm', 'fog', 'glow'] as const).some((weather) =>
            catchTable(
              ctx({ zone, phase, weather, depth: (species.depth[0] + species.depth[1]) / 2, bait: species.baits[0] ?? 'mie' }),
            ).some((e) => e.species.id === species.id),
          ),
        ),
      );
      expect(found, species.id).toBe(true);
    }
  });
});

describe('rolls', () => {
  it('is reproducible with a seed', () => {
    const run = (seed: number) => {
      const rng = new Rng(seed);
      return Array.from({ length: 30 }, () => rollSpecies(ctx({ depth: 0.4 }), rng).id);
    };
    expect(run(2024)).toEqual(run(2024));
    expect(run(2024)).not.toEqual(run(2025));
  });

  it('matches the table probabilities', () => {
    const rng = new Rng(5);
    const c = ctx({ depth: 0.3 });
    const odds = catchOdds(c);
    const counts = new Map<string, number>();
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const id = rollSpecies(c, rng).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const o of odds) {
      expect(Math.abs((counts.get(o.species.id) ?? 0) / n - o.chance)).toBeLessThan(0.02);
    }
  });

  it('calls the legend only with the special lure, far into the Fosse', () => {
    const rng = new Rng(8);
    expect(rollSpecies(ctx({ zone: 'fosse', depth: 0.9, bait: 'leurre' }), rng).id).toBe('veilleuse');
    expect(rollSpecies(ctx({ zone: 'fosse', depth: 0.2, bait: 'leurre' }), rng).id).not.toBe('veilleuse');
    for (let i = 0; i < 500; i++) {
      expect(rollSpecies(ctx({ zone: 'fosse', depth: 0.95, bait: 'lumignon', luck: 2 }), rng).id).not.toBe('veilleuse');
    }
  });

  it('rolls fish inside the species ranges', () => {
    const rng = new Rng(3);
    const species = getSpecies('bar');
    for (let i = 0; i < 500; i++) {
      const fish = rollFish(species, rng, 0.2, 'anse', 1, i);
      expect(fish.size).toBeGreaterThanOrEqual(species.size[0]);
      expect(fish.size).toBeLessThanOrEqual(species.size[1]);
      expect(fish.weight).toBeGreaterThanOrEqual(species.weight[0]);
      expect(fish.weight).toBeLessThanOrEqual(species.weight[1]);
      expect(fish.value).toBeGreaterThan(0);
    }
  });

  it('produces the four variants, rarely', () => {
    const rng = new Rng(12);
    const seen = new Set<string>();
    let special = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const v = rollVariant(rng, 0);
      seen.add(v);
      if (v !== 'normal') special += 1;
    }
    expect(seen).toEqual(new Set(['normal', 'albino', 'melanic', 'golden', 'shimmer']));
    expect(special / n).toBeGreaterThan(0.03);
    expect(special / n).toBeLessThan(0.07);
  });

  it('values variants and big fish higher', () => {
    const species = getSpecies('mulet');
    expect(fishValue(species, 1, 'normal')).toBeGreaterThan(fishValue(species, 0, 'normal'));
    expect(fishValue(species, 0.5, 'golden')).toBeGreaterThan(fishValue(species, 0.5, 'albino'));
    expect(fishValue(species, 0.5, 'shimmer')).toBeGreaterThan(fishValue(species, 0.5, 'golden'));
  });

  it('keeps the hook window between 0.4 and 1 second', () => {
    for (const species of SPECIES) {
      for (const bonus of [0, 0.2]) {
        const w = hookWindow(species, bonus, species.zones[0]!);
        expect(w).toBeGreaterThanOrEqual(0.4);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });
});
