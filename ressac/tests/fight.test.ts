import { describe, expect, it } from 'vitest';
import { createNewState } from '../src/core/state';
import { Rng } from '../src/core/rng';
import { getSpecies } from '../src/data/species';
import { autoFight, buildFightParams, fightDuration, FightModel } from '../src/systems/fight';
import { playerStats } from '../src/systems/stats';

const stats = playerStats(createNewState(1));

function run(model: FightModel, reel: (m: FightModel) => boolean, maxSeconds = 120): void {
  const dt = 1 / 60;
  for (let t = 0; t < maxSeconds && model.status === 'active'; t += dt) model.update(dt, reel(model));
}

describe('fight model', () => {
  it('snaps the line when the player never stops reeling', () => {
    const model = new FightModel(buildFightParams(getSpecies('bar'), 0.5, stats, 'beginner', false), new Rng(1));
    run(model, () => true);
    expect(model.status).toBe('snapped');
  });

  it('lets the fish go when the player never reels', () => {
    const model = new FightModel(buildFightParams(getSpecies('bar'), 0.5, stats, 'beginner', false), new Rng(1));
    run(model, () => false);
    expect(model.status).toBe('escaped');
  });

  it('lands the fish when the tension is kept in the safe zone', () => {
    const model = new FightModel(buildFightParams(getSpecies('gobie'), 0.5, stats, 'beginner', false), new Rng(2));
    run(model, (m) => m.tension < m.safeCenter);
    expect(model.status).toBe('caught');
    expect(model.time).toBeGreaterThan(2);
    expect(model.time).toBeLessThan(12);
  });

  it('cannot be lost in forgiving (tutorial) mode', () => {
    const params = buildFightParams(getSpecies('gobie'), 0.5, stats, 'beginner', false, true);
    const model = new FightModel(params, new Rng(3));
    run(model, () => false, 20);
    expect(model.status).toBe('active');
    run(model, () => true, 60);
    expect(model.status).toBe('caught');
  });

  it('widens the safe zone in assisted mode', () => {
    const normal = buildFightParams(getSpecies('congre'), 0.5, stats, 'beginner', false);
    const assisted = buildFightParams(getSpecies('congre'), 0.5, stats, 'beginner', true);
    expect(assisted.safeWidth).toBeGreaterThan(normal.safeWidth);
  });

  it('lasts between 3 and 30 seconds by design', () => {
    expect(fightDuration(0.05)).toBeGreaterThanOrEqual(3);
    expect(fightDuration(1)).toBeLessThanOrEqual(30);
    expect(fightDuration(1)).toBeGreaterThan(fightDuration(0.3));
  });

  it('makes commons easy and legends hard for a simulated player', () => {
    const rate = (id: string) => {
      const rng = new Rng(77);
      let wins = 0;
      for (let i = 0; i < 200; i++) {
        if (autoFight(buildFightParams(getSpecies(id), 0.5, stats, 'beginner', false), rng, 0.7).status === 'caught') wins++;
      }
      return wins / 200;
    };
    const easy = rate('gobie');
    const hard = rate('dorade');
    expect(easy).toBeGreaterThan(0.9);
    expect(hard).toBeLessThan(easy);
  });

  it('exposes every behaviour', () => {
    const jumper = new FightModel(buildFightParams(getSpecies('brochet'), 0.5, stats, 'still', false, true), new Rng(4));
    let sawWarning = false;
    run(jumper, (m) => {
      if (m.jumpWarning > 0) sawWarning = true;
      return m.tension < m.safeCenter && m.jumpWarning <= 0 && m.jumping <= 0;
    });
    expect(sawWarning).toBe(true);

    const cunning = new FightModel(buildFightParams(getSpecies('dorade'), 0.5, stats, 'beginner', false, true), new Rng(5));
    run(cunning, (m) => m.tension < m.safeCenter, 40);
    expect(cunning.flips).toBeGreaterThan(0);

    const diver = new FightModel(buildFightParams(getSpecies('sole'), 0.5, stats, 'beginner', false, true), new Rng(6));
    let sawSurge = false;
    run(diver, (m) => {
      if (m.surge > 0) sawSurge = true;
      return m.tension < m.safeCenter;
    }, 40);
    expect(sawSurge).toBe(true);
  });
});
