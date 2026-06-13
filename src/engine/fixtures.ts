import { hashSeed, makeRng, shuffle } from './rng';
import type { ClubId, Fixture } from './types';

const BYE = '__BYE__';

/**
 * Double round-robin schedule via the circle method: every club plays every
 * other club twice (once home, once away). For N clubs that's 2*(N-1)
 * matchdays with N/2 matches each. The club order is shuffled per season (from
 * the seed) so fixture lists vary while staying fully reproducible.
 */
export function generateFixtures(clubIds: ClubId[], seed: number, seasonNumber = 1): Fixture[] {
  const rng = makeRng(hashSeed(seed, 7777, seasonNumber));
  let teams = shuffle(rng, clubIds);
  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams = [...teams, BYE];

  const m = teams.length;
  const rounds = m - 1;
  const half = m / 2;
  const arr = teams.slice();
  const firstHalf: Fixture[] = [];
  let fid = 0;

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const t1 = arr[i];
      const t2 = arr[m - 1 - i];
      if (t1 === BYE || t2 === BYE) continue;
      // alternate venue by round+slot so no club is home every round
      const homeFirst = (r + i) % 2 === 0;
      const homeClubId = homeFirst ? t1 : t2;
      const awayClubId = homeFirst ? t2 : t1;
      firstHalf.push({ id: `F${fid++}`, matchday: r + 1, homeClubId, awayClubId });
    }
    // rotate all but the first element
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as ClubId);
    for (let k = 1; k < m; k++) arr[k] = rest[k - 1];
  }

  // second leg: mirror with reversed venues
  const fixtures = firstHalf.slice();
  for (const f of firstHalf) {
    fixtures.push({
      id: `F${fid++}`,
      matchday: f.matchday + rounds,
      homeClubId: f.awayClubId,
      awayClubId: f.homeClubId,
    });
  }

  return fixtures;
}
