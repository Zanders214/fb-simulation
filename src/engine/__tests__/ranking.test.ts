import { RANKING } from '../config';
import {
  applyMatchRanking,
  clubRanking,
  expectedScore,
  initialRanking,
  rankingPositionDelta,
  rankingRewardMultiplier,
} from '../ranking';
import type { MatchResult, World } from '../types';

/** Minimal two-club world for exercising the ranking maths directly. */
function twoClubWorld(homeRanking: number, awayRanking: number): World {
  const club = (id: string, ranking: number) => ({
    id,
    leagueId: 'L0',
    name: id,
    shortName: id,
    reputation: 50,
    budget: 0,
    ranking,
    primaryColor: '#ffffff',
    secondaryColor: '#000000',
    playerIds: [],
  });
  return {
    seed: 1,
    generatorVersion: 1,
    countries: {},
    leagues: {},
    clubs: { H: club('H', homeRanking), A: club('A', awayRanking) },
    players: {},
  };
}

function result(homeGoals: number, awayGoals: number): MatchResult {
  return {
    homeClubId: 'H',
    awayClubId: 'A',
    homeGoals,
    awayGoals,
    events: [],
    ratings: {},
    stats: {
      home: { possession: 0.5, chances: 0, xg: 0, goals: homeGoals },
      away: { possession: 0.5, chances: 0, xg: 0, goals: awayGoals },
    },
  };
}

describe('initialRanking', () => {
  it('is monotonic in reputation', () => {
    expect(initialRanking(60)).toBeGreaterThan(initialRanking(40));
    expect(initialRanking(88)).toBeGreaterThan(initialRanking(60));
  });
});

describe('expectedScore', () => {
  it('is 0.5 at parity and tilts toward the stronger side', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 6);
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1500)).toBeLessThan(0.5);
  });

  it("two sides' expected scores sum to 1", () => {
    expect(expectedScore(1700, 1400) + expectedScore(1400, 1700)).toBeCloseTo(1, 6);
  });
});

describe('applyMatchRanking', () => {
  it('is zero-sum: the winner gains exactly what the loser drops', () => {
    const w = twoClubWorld(1500, 1500);
    applyMatchRanking(w, result(2, 0));
    const homeDelta = clubRanking(w, 'H') - 1500;
    const awayDelta = clubRanking(w, 'A') - 1500;
    expect(homeDelta).toBeGreaterThan(0);
    expect(homeDelta + awayDelta).toBeCloseTo(0, 6);
  });

  it('rewards an upset more than beating a weaker side', () => {
    const underdog = twoClubWorld(1300, 1800); // weak home beats strong away
    applyMatchRanking(underdog, result(1, 0));
    const upsetGain = clubRanking(underdog, 'H') - 1300;

    const favourite = twoClubWorld(1800, 1300); // strong home beats weak away
    applyMatchRanking(favourite, result(1, 0));
    const routineGain = clubRanking(favourite, 'H') - 1800;

    expect(upsetGain).toBeGreaterThan(routineGain);
  });

  it('is deterministic', () => {
    const a = twoClubWorld(1480, 1620);
    applyMatchRanking(a, result(3, 1));
    const b = twoClubWorld(1480, 1620);
    applyMatchRanking(b, result(3, 1));
    expect(clubRanking(a, 'H')).toBe(clubRanking(b, 'H'));
  });
});

describe('clubRanking', () => {
  it('falls back to a reputation-derived value when unset', () => {
    const w = twoClubWorld(1500, 1500);
    delete w.clubs.H.ranking;
    expect(clubRanking(w, 'H')).toBe(initialRanking(w.clubs.H.reputation));
  });
});

describe('rankingRewardMultiplier', () => {
  it('is 1 at parity, higher vs a stronger side, lower vs a weaker side', () => {
    expect(rankingRewardMultiplier(1500, 1500)).toBeCloseTo(1, 6);
    expect(rankingRewardMultiplier(1300, 1800)).toBeGreaterThan(1);
    expect(rankingRewardMultiplier(1800, 1300)).toBeLessThan(1);
  });

  it('stays within the configured band even for extreme gaps', () => {
    const pairs: readonly (readonly [number, number])[] = [
      [1000, 3000],
      [3000, 1000],
      [1500, 1500],
      [1200, 1900],
    ];
    for (const [a, b] of pairs) {
      const m = rankingRewardMultiplier(a, b);
      expect(m).toBeGreaterThanOrEqual(RANKING.REWARD_MULT_MIN);
      expect(m).toBeLessThanOrEqual(RANKING.REWARD_MULT_MAX);
    }
  });
});

describe('rankingPositionDelta', () => {
  it('rewards the top, punishes the bottom, and sums to ~0 over a league', () => {
    const size = 16;
    expect(rankingPositionDelta(1, size)).toBeCloseTo(RANKING.POSITION_SWING, 6);
    expect(rankingPositionDelta(size, size)).toBeCloseTo(-RANKING.POSITION_SWING, 6);
    expect(rankingPositionDelta(1, size)).toBeGreaterThan(rankingPositionDelta(2, size));

    let sum = 0;
    for (let p = 1; p <= size; p++) sum += rankingPositionDelta(p, size);
    expect(sum).toBeCloseTo(0, 6);
  });
});
