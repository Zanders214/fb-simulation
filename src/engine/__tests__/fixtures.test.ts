import { generateFixtures } from '../fixtures';

describe('fixtures (double round-robin)', () => {
  const clubs = Array.from({ length: 16 }, (_, i) => `C${i}`);
  const fx = generateFixtures(clubs, 42, 1);

  it('has 2*(N-1) matchdays with N/2 matches each', () => {
    expect(fx.length).toBe(16 * 15); // 240
    const md: Record<number, number> = {};
    for (const f of fx) md[f.matchday] = (md[f.matchday] ?? 0) + 1;
    expect(Object.keys(md).length).toBe(30);
    for (let d = 1; d <= 30; d++) expect(md[d]).toBe(8);
  });

  it('each team plays exactly once per matchday and never itself', () => {
    for (let d = 1; d <= 30; d++) {
      const seen = new Set<string>();
      for (const f of fx.filter((g) => g.matchday === d)) {
        expect(f.homeClubId).not.toBe(f.awayClubId);
        expect(seen.has(f.homeClubId)).toBe(false);
        expect(seen.has(f.awayClubId)).toBe(false);
        seen.add(f.homeClubId);
        seen.add(f.awayClubId);
      }
      expect(seen.size).toBe(16);
    }
  });

  it('each ordered (home, away) pair occurs exactly once', () => {
    const pair: Record<string, number> = {};
    for (const f of fx) {
      const key = `${f.homeClubId}>${f.awayClubId}`;
      pair[key] = (pair[key] ?? 0) + 1;
    }
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        if (i === j) continue;
        expect(pair[`C${i}>C${j}`]).toBe(1);
      }
    }
  });

  it('is reproducible per (seed, season) and varies by season', () => {
    expect(JSON.stringify(generateFixtures(clubs, 42, 1))).toEqual(JSON.stringify(fx));
    expect(JSON.stringify(generateFixtures(clubs, 42, 2))).not.toEqual(JSON.stringify(fx));
  });
});
