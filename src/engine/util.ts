/** Tiny pure math helpers shared across the engine. No React, no I/O. */

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

/** Round to one decimal place (used for player ratings). */
export const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Logistic / sigmoid. */
export const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/** Sum of an array of numbers. */
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Average of an array (0 for empty). */
export const mean = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);
