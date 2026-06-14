import { computeTable } from '../standings';
import type { MatchResult, Season } from '../types';

function res(h: number, a: number): MatchResult {
  return {
    homeClubId: '',
    awayClubId: '',
    homeGoals: h,
    awayGoals: a,
    events: [],
    cards: [],
    injuries: [],
    subs: [],
    ratings: {},
    stats: {
      home: { possession: 0.5, chances: 0, xg: 0, goals: h },
      away: { possession: 0.5, chances: 0, xg: 0, goals: a },
    },
  };
}

describe('standings', () => {
  it('orders by points, then goal difference, then goals for', () => {
    const season: Season = {
      number: 1,
      leagueId: 'L',
      currentMatchday: 3,
      totalMatchdays: 2,
      fixtures: [
        { id: 'f1', matchday: 1, homeClubId: 'A', awayClubId: 'B', result: res(3, 0) },
        { id: 'f2', matchday: 1, homeClubId: 'C', awayClubId: 'D', result: res(1, 0) },
        { id: 'f3', matchday: 2, homeClubId: 'A', awayClubId: 'C', result: res(1, 1) },
        { id: 'f4', matchday: 2, homeClubId: 'B', awayClubId: 'D', result: res(2, 2) },
      ],
    };
    const t = computeTable(season, ['A', 'B', 'C', 'D']);

    // A: W+D = 4 pts, GD +3 ; C: W+D = 4 pts, GD +1 ; D: L+D = 1 pt, GD -1 ; B: L+D = 1 pt, GD -3
    expect(t.map((r) => r.clubId)).toEqual(['A', 'C', 'D', 'B']);
    expect(t[0].points).toBe(4);
    expect(t[1].points).toBe(4);
    expect(t[0].gd).toBeGreaterThan(t[1].gd);
    expect(t[2].points).toBe(1);
    expect(t[3].points).toBe(1);
    expect(t.every((r) => r.played === 2)).toBe(true);
  });
});
