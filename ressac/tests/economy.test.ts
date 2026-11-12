import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { getBoat } from '../src/data/equipment';
import { xpToNext } from '../src/systems/progression';
import { land, newGame } from './helpers';

describe('economy', () => {
  it('sells fish for coins and reputation', () => {
    const game = newGame();
    const a = land(game, 'gobie');
    const b = land(game, 'mulet');
    game.keepFish(a.fish);
    game.keepFish(b.fish);
    expect(game.state.creel).toHaveLength(2);
    const price = game.priceOf(a.fish);
    expect(game.sellFish(a.fish.uid)).toBe(price);
    expect(game.state.coins).toBeGreaterThanOrEqual(price);
    expect(game.state.creel).toHaveLength(1);
    expect(game.state.stats.sold).toBe(1);
    expect(game.sellFish(9999)).toBe(0);
  });

  it('keeps locked fish out of "sell all"', () => {
    const game = newGame();
    const fish = [land(game, 'gobie').fish, land(game, 'eperlan').fish, land(game, 'anchois').fish];
    fish.forEach((f) => game.keepFish(f));
    game.toggleLock(fish[1]!.uid);
    const before = game.state.coins;
    const gained = game.sellAll();
    expect(gained).toBeGreaterThan(0);
    expect(game.state.coins).toBe(before + gained);
    expect(game.state.creel.map((f) => f.uid)).toEqual([fish[1]!.uid]);
  });

  it('refuses purchases without coins, level or story progress', () => {
    const game = newGame();
    expect(game.buy('rod-noisetier')).toEqual({ ok: false, reason: 'coins' });
    game.state.coins = 100000;
    expect(game.buy('rod-bambou')).toEqual({ ok: false, reason: 'locked' });
    expect(game.buy('boat-2')).toEqual({ ok: false, reason: 'locked' });
    expect(game.buy('rod-noisetier').ok).toBe(true);
    expect(game.state.equipment.rod).toBe('rod-noisetier');
    expect(game.buy('rod-noisetier')).toEqual({ ok: false, reason: 'owned' });
    expect(game.buy('mie').ok).toBe(false);
  });

  it('buys, stocks and consumes baits', () => {
    const game = newGame();
    game.state.coins = 100;
    expect(game.buy('ver').ok).toBe(true);
    expect(game.state.baits.ver).toBe(10);
    game.equip('ver');
    expect(game.baitId()).toBe('ver');
    for (let i = 0; i < 10; i++) land(game, 'gobie');
    expect(game.state.baits.ver).toBe(0);
    expect(game.baitId()).toBe('mie');
  });

  it('crafts baits from the creel', () => {
    const game = newGame();
    expect(game.canCraft('patee')).toBe(false);
    for (let i = 0; i < 3; i++) game.keepFish(land(game, 'gobie').fish);
    const rare = land(game, 'bar', 0.5).fish;
    game.keepFish(rare);
    expect(game.canCraft('patee')).toBe(true);
    expect(game.craft('patee')).toBe(true);
    expect(game.state.baits.patee).toBe(6);
    // The cheapest fish were used: the rare one is still there.
    expect(game.state.creel.map((f) => f.uid)).toEqual([rare.uid]);
    expect(game.craft('lumignon')).toBe(true);
    expect(game.state.creel).toHaveLength(0);
    expect(game.canCraft('leurre')).toBe(false);
  });

  it('sells boats in order and enlarges the creel', () => {
    const game = newGame();
    game.debugUnlockAll();
    const fresh = newGame();
    fresh.state.coins = 1e6;
    fresh.state.story.index = 15;
    expect(fresh.buy('boat-3')).toEqual({ ok: false, reason: 'order' });
    expect(fresh.buy('boat-2').ok).toBe(true);
    expect(fresh.stats().creelSize).toBe(getBoat('boat-2').creel);
    expect(fresh.buy('boat-3').ok).toBe(true);
  });

  it('stops keeping fish when the creel is full', () => {
    const game = newGame();
    const size = game.stats().creelSize;
    for (let i = 0; i < size; i++) expect(game.keepFish(land(game, 'gobie').fish)).toBe(true);
    expect(game.creelFull()).toBe(true);
    expect(game.keepFish(land(game, 'gobie').fish)).toBe(false);
  });

  it('levels up along the XP curve', () => {
    const game = newGame();
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
    let ups = 0;
    game.events.on('levelUp', () => ups++);
    for (let i = 0; i < 12; i++) land(game, 'gobie');
    expect(game.state.level).toBeGreaterThan(1);
    expect(ups).toBe(game.state.level - 1);
    expect(game.state.xp).toBeLessThan(xpToNext(game.state.level));
  });

  it('moves fish to the aquarium and back', () => {
    const game = newGame();
    const fish = land(game, 'vieille', 0.5).fish;
    game.keepFish(fish);
    expect(game.toAquarium(fish.uid)).toBe(true);
    expect(game.state.creel).toHaveLength(0);
    expect(game.state.aquarium).toHaveLength(1);
    expect(game.fromAquarium(fish.uid)).toBe(true);
    expect(game.state.aquarium).toHaveLength(0);
    for (let i = 0; i < BALANCE.aquariumSlots + 1; i++) {
      const f = land(game, 'gobie').fish;
      game.keepFish(f);
      game.toAquarium(f.uid);
    }
    expect(game.state.aquarium).toHaveLength(BALANCE.aquariumSlots);
  });
});
