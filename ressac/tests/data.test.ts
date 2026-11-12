import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { INTRO_PANELS, JOURNAL_PAGES, TUTORIAL_STEPS } from '../src/data/dialogues';
import { BAITS, BOATS, COSMETICS, HOOKS, hasItem, ITEMS, LINES, REELS, RODS } from '../src/data/equipment';
import { CHALLENGES, DAILY_TEMPLATES, STORY } from '../src/data/missions';
import { SPECIES, speciesOfZone } from '../src/data/species';
import { RARITIES, VARIANTS } from '../src/data/types';
import { ZONES } from '../src/data/zones';

describe('content', () => {
  it('has 6 zones and at least 60 species, about 10 per zone', () => {
    expect(ZONES).toHaveLength(6);
    expect(SPECIES.length).toBeGreaterThanOrEqual(60);
    for (const zone of ZONES) {
      expect(speciesOfZone(zone.id).length, zone.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('uses unique ids everywhere', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(SPECIES.map((s) => s.name)).size).toBe(SPECIES.length);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('covers the six rarities with exactly one mythic per zone', () => {
    for (const rarity of RARITIES) expect(SPECIES.some((s) => s.rarity === rarity)).toBe(true);
    for (const zone of ZONES) {
      const mythics = speciesOfZone(zone.id).filter((s) => s.rarity === 'mythic');
      expect(mythics, zone.id).toHaveLength(1);
    }
    expect(VARIANTS).toHaveLength(4);
  });

  it('gives every species coherent data', () => {
    for (const s of SPECIES) {
      expect(s.depth[0]).toBeLessThan(s.depth[1]);
      expect(s.size[0]).toBeLessThan(s.size[1]);
      expect(s.weight[0]).toBeLessThan(s.weight[1]);
      expect(s.baseValue).toBeGreaterThan(0);
      expect(s.flavor.length).toBeGreaterThan(10);
      expect(s.phases.length).toBeGreaterThan(0);
      for (const bait of s.baits) expect(hasItem(bait), `${s.id} → ${bait}`).toBe(true);
    }
  });

  it('gives every species a distinct look', () => {
    const looks = SPECIES.map((s) => JSON.stringify(s.art));
    expect(new Set(looks).size).toBe(SPECIES.length);
  });

  it('ships the full equipment list', () => {
    expect(RODS).toHaveLength(8);
    expect(REELS).toHaveLength(6);
    expect(LINES).toHaveLength(5);
    expect(HOOKS).toHaveLength(5);
    expect(BAITS.filter((b) => !b.special).length).toBe(10);
    expect(BAITS.some((b) => b.craft)).toBe(true);
    expect(BOATS).toHaveLength(4);
    expect(COSMETICS.length).toBeGreaterThanOrEqual(15);
    const sorted = [...RODS].sort((a, b) => a.price - b.price);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.reach).toBeGreaterThan(sorted[i - 1]!.reach);
  });

  it('references existing missions, zones and items', () => {
    const ids = new Set(STORY.map((m) => m.id));
    for (const zone of ZONES) if (zone.unlockMission) expect(ids.has(zone.unlockMission)).toBe(true);
    for (const item of ITEMS) if (item.mission) expect(ids.has(item.mission), item.id).toBe(true);
    for (const zone of ZONES.slice(1)) {
      const mission = STORY.find((m) => m.id === zone.unlockMission);
      expect(mission?.reward.unlockZone, zone.id).toBe(zone.id);
    }
    for (const m of [...STORY, ...CHALLENGES]) {
      for (const bait of Object.keys(m.reward.baits ?? {})) expect(hasItem(bait)).toBe(true);
    }
  });

  it('has enough achievements, journal pages and narrative content', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(JOURNAL_PAGES).toHaveLength(10);
    expect(INTRO_PANELS.length).toBeGreaterThanOrEqual(3);
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(DAILY_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(8);
  });
});
