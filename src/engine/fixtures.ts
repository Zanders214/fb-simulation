import { hashSeed, makeRng, shuffle } from './rng';
import type { ClubId, Fixture } from './types';

const BYE = '__BYE__';

/**
 * Double round-robin schedule via the circle method: every club plays every
 * other club twice (once home, once away). For N clubs that's 2*(N-1)
 * matchdays with N/2 matches each. The club order is shuffled per season (from
 * the seed) so fixture lists vary while staying fully reproducible.
 */
interface RawFixture {
  matchday: number;
  homeClubId: ClubId;
  awayClubId: ClubId;
}

/** Rotate all but the first element one step (circle-method round rotation). */
function rotate(arr: ClubId[]): void {
  const rest = arr.slice(1);
  rest.unshift(rest.pop() as ClubId);
  for (let k = 1; k < arr.length; k++) arr[k] = rest[k - 1];
}

/** Single round-robin: each pair once, venue alternating by round + slot. */
function buildFirstHalf(teams: ClubId[]): RawFixture[] {
  const m = teams.length;
  const half = m / 2;
  const arr = teams.slice();
  const out: RawFixture[] = [];
  for (let r = 0; r < m - 1; r++) {
    for (let i = 0; i < half; i++) {
      const t1 = arr[i];
      const t2 = arr[m - 1 - i];
      if (t1 !== BYE && t2 !== BYE) {
        const homeFirst = (r + i) % 2 === 0;
        out.push({ matchday: r + 1, homeClubId: homeFirst ? t1 : t2, awayClubId: homeFirst ? t2 : t1 });
      }
    }
    rotate(arr);
  }
  return out;
}

export function generateFixtures(clubIds: ClubId[], seed: number, seasonNumber = 1): Fixture[] {
  const rng = makeRng(hashSeed(seed, 7777, seasonNumber));
  let teams = shuffle(rng, clubIds);
  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams = [...teams, BYE];

  const rounds = teams.length - 1;
  const firstHalf = buildFirstHalf(teams);
  const fixtures: Fixture[] = [];
  let fid = 0;
  for (const f of firstHalf) {
    fixtures.push({ id: `F${fid++}`, matchday: f.matchday, homeClubId: f.homeClubId, awayClubId: f.awayClubId });
  }
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
