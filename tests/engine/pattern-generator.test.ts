import { describe, it, expect } from 'vitest';
import { generateStringFromPattern } from '../../src/modules/engine/generation/pattern-generator.js';
import { createPrng } from '../../src/modules/engine/generation/prng.js';

describe('pattern-generator', () => {
  const prng = createPrng(42);

  it('generates valid ISO date-time strings matching regex', () => {
    const pattern = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$';
    const regex = new RegExp(pattern);

    for (let i = 0; i < 20; i++) {
      const generated = generateStringFromPattern(pattern, prng);
      expect(regex.test(generated)).toBe(true);
    }
  });

  it('generates valid ISO date strings matching regex', () => {
    const pattern = '^\\d{4}-\\d{2}-\\d{2}$';
    const regex = new RegExp(pattern);

    for (let i = 0; i < 20; i++) {
      const generated = generateStringFromPattern(pattern, prng);
      expect(regex.test(generated)).toBe(true);
    }
  });

  it('generates alphanumeric codes matching SKU patterns', () => {
    const pattern = '^[A-Z0-9]{8}$';
    const regex = new RegExp(pattern);

    for (let i = 0; i < 20; i++) {
      const generated = generateStringFromPattern(pattern, prng);
      expect(regex.test(generated)).toBe(true);
      expect(generated.length).toBe(8);
    }
  });

  it('generates digit sequences of exact length', () => {
    const pattern = '^\\d{6}$';
    const regex = new RegExp(pattern);

    for (let i = 0; i < 20; i++) {
      const generated = generateStringFromPattern(pattern, prng);
      expect(regex.test(generated)).toBe(true);
      expect(generated.length).toBe(6);
    }
  });
});
