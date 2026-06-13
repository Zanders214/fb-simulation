/**
 * Deterministic, seedable pseudo-random number generation.
 *
 * The whole engine is pure: every stochastic decision goes through an injected
 * `Rng` so a given seed always reproduces the same world, the same match, the
 * same season. We never touch the global Math.random or the clock.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
}

/** mulberry32 — 32-bit, fast, dependency-free, good enough for a game. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  return { next };
}

/**
 * Combine several integers into a single 32-bit seed (FNV-1a-ish with extra
 * mixing). Used to derive independent, order-independent per-entity streams,
 * e.g. hashSeed(worldSeed, SALT_PLAYER, clubIndex, playerIndex).
 */
export function hashSeed(...vals: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of vals) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  h ^= h >>> 16;
  return h >>> 0;
}

/** Independent stream derived from a base seed + salts. */
export function streamFor(seed: number, ...salts: number[]): Rng {
  return makeRng(hashSeed(seed, ...salts));
}

// ---- distribution helpers (all consume the Rng stream in call order) ----

/** Inclusive integer in [lo, hi]. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

/** Float in [lo, hi). */
export function randFloat(rng: Rng, lo: number, hi: number): number {
  return lo + rng.next() * (hi - lo);
}

/** True with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** Normal draw via Box–Muller. */
export function gaussian(rng: Rng, mean = 0, sd = 1): number {
  const u1 = Math.max(rng.next(), 1e-9);
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

/** Poisson(lambda) via Knuth. Lambda is capped to keep the loop bounded. */
export function poisson(rng: Rng, lambda: number): number {
  const lam = Math.min(Math.max(lambda, 0), 40);
  if (lam <= 0) return 0;
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

/** Index chosen proportionally to non-negative weights. */
export function pickWeightedIndex(rng: Rng, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return randInt(rng, 0, Math.max(0, weights.length - 1));
  let x = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= Math.max(0, weights[i]);
    if (x < 0) return i;
  }
  return weights.length - 1;
}

/** In-place-free Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
