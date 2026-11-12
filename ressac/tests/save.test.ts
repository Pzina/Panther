import { describe, expect, it } from 'vitest';
import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION } from '../src/config/constants';
import {
  checksum,
  exportCode,
  importCode,
  MemoryStorage,
  parseSave,
  sanitize,
  SaveManager,
  serialize,
} from '../src/core/save';
import { createNewState } from '../src/core/state';
import { land, newGame } from './helpers';

describe('save', () => {
  it('round-trips a state', () => {
    const game = newGame();
    land(game, 'gobie');
    game.state.coins = 321;
    const result = parseSave(serialize(game.state));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.coins).toBe(321);
      expect(result.state.dex.gobie?.count).toBe(1);
      expect(result.state.saveVersion).toBe(SAVE_VERSION);
    }
  });

  it('never throws on corrupted data', () => {
    const good = serialize(createNewState(5));
    const bad = [
      '',
      'not json',
      '{"v":2}',
      '[1,2,3]',
      'null',
      good.slice(0, good.length / 2),
      good.replace('"coins":0', '"coins":999999'),
      JSON.stringify({ v: 99, t: 0, sum: checksum('{}'), data: {} }),
    ];
    for (const raw of bad) {
      expect(() => parseSave(raw)).not.toThrow();
      expect(parseSave(raw).ok).toBe(false);
    }
  });

  it('detects a tampered save through the checksum', () => {
    const raw = serialize(createNewState(5)).replace('"coins":0', '"coins":5000');
    const result = parseSave(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('checksum');
  });

  it('sanitises unknown ids and wrong types', () => {
    const state = sanitize({
      seed: 3,
      coins: -50,
      level: 'huge',
      zone: 'atlantide',
      unlockedZones: ['etang', 'nowhere'],
      owned: ['rod-bambou', 'rod-laser'],
      equipment: { rod: 'rod-laser', reel: 'reel-bois' },
      creel: [
        { speciesId: 'gobie', size: 10, weight: 0.02, value: 5, uid: 4 },
        { speciesId: 'dragon-rouge' },
        12,
      ],
      dex: { gobie: { count: 2, maxSize: 11, maxWeight: 0.03, variants: ['golden', 'plaid'] }, licorne: {} },
      settings: { music: 4, textScale: 'big' },
    });
    expect(state.coins).toBe(0);
    expect(state.level).toBe(1);
    expect(state.zone).toBe('anse');
    expect(state.unlockedZones).toEqual(['anse', 'etang']);
    expect(state.owned).toContain('rod-bambou');
    expect(state.owned).not.toContain('rod-laser');
    expect(state.equipment.rod).toBe('rod-heritage');
    expect(state.creel).toHaveLength(1);
    expect(state.nextUid).toBe(5);
    expect(state.dex.gobie?.variants).toEqual(['golden']);
    expect(state.dex.licorne).toBeUndefined();
    expect(state.settings.music).toBe(1);
    expect(state.settings.textScale).toBe(1);
  });

  it('migrates an old save format', () => {
    const old = { seed: 9, gold: 250, settings: { volume: 0.3 }, saveVersion: 1 };
    const raw = JSON.stringify({ v: 1, t: 0, sum: checksum(JSON.stringify(old)), data: old });
    const result = parseSave(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.coins).toBe(250);
      expect(result.state.settings.music).toBeCloseTo(0.3);
      expect(result.state.settings.sfx).toBeCloseTo(0.3);
      expect(result.state.aquarium).toEqual([]);
      expect(result.state.saveVersion).toBe(SAVE_VERSION);
    }
  });

  it('exports and imports a text code', () => {
    const game = newGame();
    land(game, 'bar', 0.5);
    game.state.coins = 77;
    const code = exportCode(game.state);
    expect(code.startsWith('RSC1.')).toBe(true);
    const back = importCode(`  ${code}\n`);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.state.coins).toBe(77);
      expect(back.state.dex.bar).toBeDefined();
    }
    expect(importCode('hello').ok).toBe(false);
    expect(importCode('RSC1.@@@').ok).toBe(false);
    expect(importCode(code.slice(0, -8) + 'AAAAAAAA').ok).toBe(false);
  });

  it('keeps a backup and offers it when the main save is corrupted', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const state = createNewState(11);
    state.coins = 500;
    manager.save(state);

    // A new session reads the save: it becomes the backup.
    const session = new SaveManager(storage);
    const first = session.load();
    expect(first.state?.coins).toBe(500);
    expect(first.corrupted).toBe(false);
    expect(storage.getItem(SAVE_BACKUP_KEY)).not.toBeNull();

    // The main save gets corrupted on purpose.
    storage.setItem(SAVE_KEY, '{"v":2,"data":{broken');
    const second = new SaveManager(storage).load();
    expect(second.state).toBeNull();
    expect(second.corrupted).toBe(true);
    expect(second.backup?.coins).toBe(500);
  });

  it('reports a clean slate when nothing is stored', () => {
    const result = new SaveManager(new MemoryStorage()).load();
    expect(result).toEqual({ state: null, corrupted: false, backup: null });
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const manager = new SaveManager(broken);
    expect(manager.load().state).toBeNull();
    expect(manager.save(createNewState(1))).toBe(false);
    expect(() => manager.clear()).not.toThrow();
  });
});
