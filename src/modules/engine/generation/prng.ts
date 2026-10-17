/**
 * Seedable, deterministic Pseudo-Random Number Generator interface.
 */
export interface Prng {
  /**
   * Returns a pseudo-random float in the range [0, 1).
   */
  next(): number;

  /**
   * Returns a pseudo-random integer in the inclusive range [min, max].
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @returns {number} Random integer.
   */
  nextInt(min: number, max: number): number;

  /**
   * Returns a pseudo-random float in the range [min, max] rounded to specified decimal places.
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @param {number} [decimals=2] - Number of decimal places.
   * @returns {number} Random float.
   */
  nextFloat(min: number, max: number, decimals?: number): number;

  /**
   * Returns a pseudo-random boolean (true or false).
   */
  nextBoolean(): boolean;

  /**
   * Picks a random item from a non-empty array.
   * @param {readonly T[]} items - Array of choices.
   * @returns {T} Selected item.
   */
  pickOne<T>(items: readonly T[]): T;

  /**
   * Returns the initial seed integer used to create this PRNG instance.
   */
  getSeed(): number;
}

/**
 * Creates a deterministic, seedable Mulberry32 PRNG instance.
 * If seed is omitted, a random seed derived from Date.now() and Math.random() is used.
 * @param {number} [seed] - Optional 32-bit integer seed for reproducible sequences.
 * @returns {Prng} Seeded PRNG instance.
 * @example
 * // Reproducible sequential testing:
 * const prng1 = createPrng(42);
 * const val1 = prng1.nextInt(1, 100);
 *
 * const prng2 = createPrng(42);
 * const val2 = prng2.nextInt(1, 100);
 * expect(val1).toBe(val2); // Guaranteed identical!
 */
export function createPrng(seed?: number): Prng {
  const initialSeed = seed !== undefined ? seed >>> 0 : (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  let state = initialSeed;

  function next(): number {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min: number, max: number): number {
    const floorMin = Math.ceil(min);
    const floorMax = Math.floor(max);
    if (floorMin >= floorMax) return floorMin;
    return Math.floor(next() * (floorMax - floorMin + 1)) + floorMin;
  }

  function nextFloat(min: number, max: number, decimals: number = 2): number {
    if (min >= max) return min;
    const raw = next() * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(raw * factor) / factor;
  }

  function nextBoolean(): boolean {
    return next() >= 0.5;
  }

  function pickOne<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = nextInt(0, items.length - 1);
    return items[idx];
  }

  return {
    next,
    nextInt,
    nextFloat,
    nextBoolean,
    pickOne,
    getSeed: () => initialSeed
  };
}
