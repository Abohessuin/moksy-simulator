import { describe, it, expect } from 'vitest';
import { createPrng } from '../../src/modules/engine/generation/prng.js';

describe('prng (Mulberry32)', () => {
  it('generates reproducible sequence with the same seed', () => {
    const prng1 = createPrng(12345);
    const seq1 = [
      prng1.nextInt(1, 100),
      prng1.nextInt(1, 100),
      prng1.nextFloat(0, 10),
      prng1.nextBoolean(),
      prng1.pickOne(['a', 'b', 'c', 'd'])
    ];

    const prng2 = createPrng(12345);
    const seq2 = [
      prng2.nextInt(1, 100),
      prng2.nextInt(1, 100),
      prng2.nextFloat(0, 10),
      prng2.nextBoolean(),
      prng2.pickOne(['a', 'b', 'c', 'd'])
    ];

    expect(seq1).toEqual(seq2);
  });

  it('generates integers within inclusive bounds', () => {
    const prng = createPrng(42);
    for (let i = 0; i < 100; i++) {
      const val = prng.nextInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('generates floats within bounds rounded to decimal places', () => {
    const prng = createPrng(99);
    for (let i = 0; i < 50; i++) {
      const val = prng.nextFloat(1.5, 4.5, 2);
      expect(val).toBeGreaterThanOrEqual(1.5);
      expect(val).toBeLessThanOrEqual(4.5);
      // Check decimal precision (at most 2 decimals)
      const decimals = (val.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });

  it('picks elements uniformly from array', () => {
    const prng = createPrng(77);
    const items = ['apple', 'banana', 'orange'];
    const chosen = new Set<string>();

    for (let i = 0; i < 30; i++) {
      const picked = prng.pickOne(items);
      expect(items).toContain(picked);
      chosen.add(picked);
    }

    expect(chosen.size).toBeGreaterThan(1);
  });
});
