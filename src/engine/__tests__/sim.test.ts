import { makeRng } from '../rng';
import { simulateMatch, type SimTeam } from '../sim';
import type { SquadRoles } from '../types';
import { makeTeam } from './factory';

function play(seed: number, levelH = 70, levelA = 70, rolesH: SquadRoles = {}, homeAdv = false) {
  const home: SimTeam = makeTeam('H', levelH, rolesH, homeAdv);
  const away: SimTeam = makeTeam('A', levelA, {}, false);
  return simulateMatch({ home, away, rng: makeRng(seed) });
}

describe('match simulation', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(play(2024))).toEqual(JSON.stringify(play(2024)));
  });

  it('rates every starter on a 1..10 scale', () => {
    const r = play(1);
    const ids = Object.keys(r.ratings);
    expect(ids.length).toBe(22);
    for (const id of ids) {
      expect(r.ratings[id].rating).toBeGreaterThanOrEqual(1);
      expect(r.ratings[id].rating).toBeLessThanOrEqual(10);
    }
  });

  it('produces a believable scoreline distribution at parity', () => {
    const N = 8000;
    const totals: number[] = [];
    let totalGoals = 0;
    let big = 0;
    for (let s = 0; s < N; s++) {
      const r = play(s, 70, 70);
      const t = r.homeGoals + r.awayGoals;
      totals.push(t);
      totalGoals += t;
      if (t >= 6) big++;
    }
    const perTeam = totalGoals / (N * 2);
    // realistic football: ~1.1-1.5 goals per team per match
    expect(perTeam).toBeGreaterThan(1.1);
    expect(perTeam).toBeLessThan(1.5);

    const counts: Record<number, number> = {};
    for (const t of totals) counts[t] = (counts[t] ?? 0) + 1;
    let mode = 0;
    let modeCount = -1;
    for (const k of Object.keys(counts)) {
      if (counts[+k] > modeCount) {
        modeCount = counts[+k];
        mode = +k;
      }
    }
    expect([1, 2, 3]).toContain(mode);
    // 6+ goal games are uncommon (~1 in 20 in real football), not absent
    expect(big / N).toBeLessThan(0.07);
  });

  it('a much stronger team outscores a weaker one', () => {
    const N = 4000;
    let strong = 0;
    let weak = 0;
    for (let s = 0; s < N; s++) {
      const r = play(s, 82, 52);
      strong += r.homeGoals;
      weak += r.awayGoals;
    }
    expect(strong / N).toBeGreaterThan(weak / N + 0.6);
  });

  it('home advantage helps the home team on aggregate', () => {
    const N = 4000;
    let withAdv = 0;
    let without = 0;
    for (let s = 0; s < N; s++) {
      withAdv += play(s, 70, 70, {}, true).homeGoals;
      without += play(s, 70, 70, {}, false).homeGoals;
    }
    expect(withAdv).toBeGreaterThan(without);
  });

  it('forwards score far more than defenders', () => {
    let fwd = 0;
    let def = 0;
    for (let s = 0; s < 3000; s++) {
      const r = play(s, 70, 70);
      for (const e of r.events) {
        if (e.scorerId.includes('FWD')) fwd++;
        else if (e.scorerId.includes('DEF')) def++;
      }
    }
    expect(fwd).toBeGreaterThan(def * 3);
  });

  it('the designated penalty taker takes every penalty', () => {
    const roles: SquadRoles = { penaltyTakerId: 'H_DEF0' };
    let pens = 0;
    let byTaker = 0;
    for (let s = 0; s < 3000; s++) {
      const r = simulateMatch({ home: makeTeam('H', 70, roles), away: makeTeam('A', 70), rng: makeRng(s) });
      for (const e of r.events) {
        if (e.type === 'penalty' && e.clubId === 'H') {
          pens++;
          if (e.scorerId === 'H_DEF0') byTaker++;
        }
      }
    }
    expect(pens).toBeGreaterThan(20);
    expect(byTaker).toBe(pens);
  });
});
