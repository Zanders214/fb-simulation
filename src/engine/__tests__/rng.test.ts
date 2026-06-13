import { hashSeed, makeRng, mulberry32, pickWeightedIndex, poisson } from '../rng';

describe('rng', () => {
  it('mulberry32 is deterministic for a seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds give different sequences', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });

  it('produces values in [0, 1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('poisson mean approximates lambda', () => {
    const rng = makeRng(42);
    const N = 20000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += poisson(rng, 3);
    expect(sum / N).toBeGreaterThan(2.8);
    expect(sum / N).toBeLessThan(3.2);
  });

  it('pickWeightedIndex favours heavy weights', () => {
    const rng = makeRng(7);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[pickWeightedIndex(rng, [1, 8, 1])]++;
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[1]).toBeGreaterThan(6000);
  });

  it('hashSeed is deterministic and order-sensitive', () => {
    expect(hashSeed(1, 2, 3)).toEqual(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toEqual(hashSeed(3, 2, 1));
  });
});
