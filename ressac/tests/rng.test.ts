import { describe, expect, it } from 'vitest';
import { hashSeed, Rng } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(new Rng(43).next()).not.toBe(seqA[0]);
  });

  it('can be resumed from its state', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const resumed = new Rng(a.state);
    expect(resumed.next()).toBe(a.next());
  });

  it('stays inside its bounds', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 2000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('respects weights', () => {
    const rng = new Rng(99);
    const counts = { a: 0, b: 0, c: 0 };
    const entries = [
      { item: 'a' as const, weight: 70 },
      { item: 'b' as const, weight: 30 },
      { item: 'c' as const, weight: 0 },
    ];
    for (let i = 0; i < 10000; i++) counts[rng.weighted(entries)!] += 1;
    expect(counts.c).toBe(0);
    expect(counts.a / 10000).toBeGreaterThan(0.66);
    expect(counts.a / 10000).toBeLessThan(0.74);
    expect(rng.weighted([{ item: 'x', weight: 0 }])).toBeUndefined();
  });

  it('hashes seeds deterministically', () => {
    expect(hashSeed(1, 'anse', 3)).toBe(hashSeed(1, 'anse', 3));
    expect(hashSeed(1, 'anse', 3)).not.toBe(hashSeed(1, 'anse', 4));
  });
});
