import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { minutesUntilPhase, phaseOf, phaseOfHour, seasonOf } from '../src/core/clock';
import { STORY } from '../src/data/missions';
import { generateDaily } from '../src/systems/missions';
import { weatherAt } from '../src/systems/weather';
import { land, newGame } from './helpers';

describe('story', () => {
  it('advances through the first missions and unlocks the pond', () => {
    const game = newGame();
    const completed: string[] = [];
    const unlocked: string[] = [];
    game.events.on('storyComplete', ({ mission }) => completed.push(mission.id));
    game.events.on('zoneUnlocked', ({ zone }) => unlocked.push(zone));

    expect(game.currentStory()?.id).toBe('s01');
    for (const id of ['gobie', 'eperlan', 'anchois']) game.keepFish(land(game, id).fish);
    expect(completed).toEqual(['s01']);

    for (const id of ['gobie', 'gobie']) game.keepFish(land(game, id).fish);
    game.sellAll();
    expect(completed).toEqual(['s01', 's02']);
    expect(game.state.baits.ver).toBe(10);

    game.state.coins = 500;
    game.buy('rod-noisetier');
    expect(completed).toContain('s03');

    land(game, 'mulet', 0.4);
    land(game, 'vieille', 0.5);
    land(game, 'bar', 0.6);
    expect(completed).not.toContain('s04');
    land(game, 'sole', 0.6);
    expect(completed).toContain('s04');
    expect(unlocked).toEqual(['etang']);
    expect(game.zoneAccess('etang').ok).toBe(true);
    expect(game.travel('etang')).toBe(true);
    expect(game.state.zone).toBe('etang');
  });

  it('can be finished from start to end with the debug helpers', () => {
    const game = newGame();
    let ended = false;
    game.events.on('ending', () => (ended = true));
    let guard = 0;
    while (game.currentStory() && guard++ < 50) game.debugSkipMission();
    expect(ended).toBe(true);
    expect(game.state.story.finished).toBe(true);
    expect(game.state.unlockedZones).toHaveLength(6);
    expect(game.state.baits.leurre).toBeGreaterThan(0);
  });

  it('gates zones behind the story and the boat', () => {
    const game = newGame();
    expect(game.zoneAccess('recif')).toEqual({ ok: false, reason: 'locked' });
    game.state.unlockedZones.push('recif');
    expect(game.zoneAccess('recif')).toEqual({ ok: false, reason: 'boat' });
    expect(game.travel('recif')).toBe(false);
  });

  it('has three acts and about fifteen missions', () => {
    expect(STORY.length).toBeGreaterThanOrEqual(15);
    expect(new Set(STORY.map((m) => m.act))).toEqual(new Set([1, 2, 3]));
    expect(new Set(STORY.map((m) => m.id)).size).toBe(STORY.length);
  });

  it('calls the legend with the lure and ends the story', () => {
    const game = newGame();
    while (game.currentStory()?.id !== 's18') game.debugSkipMission();
    game.debugUnlockAll();
    game.travel('fosse');
    game.equip('leurre');
    expect(game.baitId()).toBe('leurre');
    const plan = game.planBite(0.95, false);
    expect(plan.species.id).toBe('veilleuse');
    game.startFight(plan);
    game.completeCatch(plan.fish);
    expect(game.state.story.finished).toBe(true);
    expect(game.legendCaught()).toBe(true);
  });
});

describe('daily missions and retention', () => {
  it('generates three stable missions per day', () => {
    const game = newGame();
    const a = generateDaily(game.state, '2026-01-10');
    const b = generateDaily(game.state, '2026-01-10');
    const c = generateDaily(game.state, '2026-01-11');
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(new Set(a.map((m) => m.templateId)).size).toBe(3);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('tracks and pays daily missions', () => {
    const game = newGame();
    game.ensureDaily();
    game.state.daily.missions = [
      { templateId: 'd-catch', kind: 'catch', target: 2, progress: 0, coins: 50, claimed: false },
    ];
    expect(game.claimDaily(0)).toBe(false);
    land(game, 'gobie');
    land(game, 'gobie');
    const before = game.state.coins;
    expect(game.claimDaily(0)).toBe(true);
    expect(game.state.coins).toBe(before + 50);
    expect(game.claimDaily(0)).toBe(false);
  });

  it('renews daily missions on a new real day', () => {
    const game = newGame();
    const day1 = Date.parse('2026-03-01T10:00:00');
    game.ensureDaily(day1);
    const first = game.state.daily.date;
    game.ensureDaily(day1 + 3600_000);
    expect(game.state.daily.date).toBe(first);
    game.ensureDaily(day1 + 86400_000);
    expect(game.state.daily.date).not.toBe(first);
  });

  it('gives a login bonus once a day over a 7-day cycle', () => {
    const game = newGame();
    const day = Date.parse('2026-03-01T10:00:00');
    expect(game.loginBonus(day)?.day).toBe(1);
    expect(game.claimLoginBonus(day)).toBe(true);
    expect(game.loginBonus(day + 3600_000)).toBeNull();
    expect(game.loginBonus(day + 86400_000)?.day).toBe(2);
    game.claimLoginBonus(day + 86400_000);
    // A missed day restarts the streak without any other penalty.
    expect(game.loginBonus(day + 3 * 86400_000)?.day).toBe(1);
  });

  it('caps the trailing net gains at eight hours', () => {
    const game = newGame();
    const now = game.state.lastSeen;
    expect(game.offlineGains(now + 60_000)).toBeNull();
    const oneHour = game.offlineGains(now + 3600_000)!;
    const day = game.offlineGains(now + 24 * 3600_000)!;
    const week = game.offlineGains(now + 7 * 24 * 3600_000)!;
    expect(oneHour.coins).toBeGreaterThan(0);
    expect(day.hours).toBe(BALANCE.offline.maxHours);
    expect(week.coins).toBe(day.coins);
    const before = game.state.coins;
    expect(game.collectOffline(now + 3600_000)).toBe(oneHour.coins);
    expect(game.state.coins).toBe(before + oneHour.coins);
  });

  it('claims collection milestones once', () => {
    const game = newGame();
    expect(game.claimMilestone(10)).toBe(false);
    for (const id of ['gobie', 'eperlan', 'anchois', 'mulet', 'vieille', 'bar', 'sole']) land(game, id, 0.5);
    expect(game.collection()).toBeGreaterThan(10);
    expect(game.claimMilestone(10)).toBe(true);
    expect(game.claimMilestone(10)).toBe(false);
    expect(game.claimMilestone(25)).toBe(false);
  });

  it('unlocks achievements', () => {
    const game = newGame();
    const got: string[] = [];
    game.events.on('achievement', ({ id }) => got.push(id));
    land(game, 'gobie');
    expect(got).toContain('first-fish');
    expect(game.state.achievements['first-fish']).toBeGreaterThan(0);
  });
});

describe('clock and weather', () => {
  it('maps hours to phases and days to seasons', () => {
    expect(phaseOfHour(6)).toBe('dawn');
    expect(phaseOfHour(12)).toBe('day');
    expect(phaseOfHour(19)).toBe('dusk');
    expect(phaseOfHour(23)).toBe('night');
    expect(phaseOfHour(2)).toBe('night');
    expect(seasonOf(0)).toBe('spring');
    expect(seasonOf(7 * 1440)).toBe('summer');
    expect(seasonOf(28 * 1440)).toBe('spring');
  });

  it('advances one in-game day in 24 real minutes', () => {
    const game = newGame();
    const start = game.state.clockMinutes;
    game.advance(BALANCE.clock.realMinutesPerDay * 60);
    expect(game.state.clockMinutes - start).toBeCloseTo(1440);
  });

  it('rests until the chosen phase', () => {
    const game = newGame();
    game.rest('night');
    expect(phaseOf(game.state.clockMinutes)).toBe('night');
    expect(game.stats().rested).toBe(true);
    expect(minutesUntilPhase(21 * 60, 'night')).toBe(1440);
  });

  it('computes a deterministic weather with rare glowing tides', () => {
    expect(weatherAt(5, 'anse', 600)).toBe(weatherAt(5, 'anse', 600));
    const counts: Record<string, number> = {};
    for (let slot = 0; slot < 4000; slot++) {
      const w = weatherAt(77, 'anse', slot * 180);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    expect(counts.sun).toBeGreaterThan(counts.storm ?? 0);
    expect(counts.glow).toBeGreaterThan(0);
    expect((counts.glow ?? 0) / 4000).toBeLessThan(0.06);
    for (let slot = 0; slot < 500; slot++) expect(weatherAt(77, 'fosse', slot * 180)).not.toBe('glow');
  });

  it('keeps the Fosse in permanent night', () => {
    const game = newGame();
    game.debugUnlockAll();
    game.state.clockMinutes = 12 * 60;
    expect(game.phase('anse')).toBe('day');
    expect(game.phase('fosse')).toBe('night');
  });
});
