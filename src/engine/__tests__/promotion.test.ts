import { CONTENT, PYRAMID } from '../config';
import { generateWorld } from '../content';
import {
  applyPromotionRelegation,
  projectedUserMovement,
  projectLeagueOrder,
} from '../promotion';
import { makeRng } from '../rng';
import {
  advanceSeason,
  createGame,
  isSeasonComplete,
  playMatchday,
} from '../season';
import type { World } from '../types';

const SLOTS = PYRAMID.PROMOTION_SLOTS;

function playFullSeason(s: ReturnType<typeof createGame>) {
  let guard = 0;
  while (!isSeasonComplete(s) && guard++ < 100) playMatchday(s);
}

/** Every league in a country must keep its full complement after a rollover. */
function expectCountrySizes(world: World, countryId: string) {
  for (const lid of world.countries[countryId].leagueIds) {
    expect(world.leagues[lid].clubIds.length).toBe(CONTENT.CLUBS_PER_LEAGUE);
    // membership is consistent: every listed club really belongs to the league
    for (const cid of world.leagues[lid].clubIds) {
      expect(world.clubs[cid].leagueId).toBe(lid);
    }
  }
}

describe('league projection', () => {
  it('projects a finishing order that is a permutation of the league', () => {
    const w = generateWorld(1);
    const lid = w.countries['CT0'].leagueIds[1];
    const order = projectLeagueOrder(w, lid, makeRng(123));
    expect([...order].sort()).toEqual([...w.leagues[lid].clubIds].sort());
  });

  it('is deterministic for the same seed', () => {
    const w = generateWorld(2);
    const lid = w.countries['CT0'].leagueIds[2];
    expect(projectLeagueOrder(w, lid, makeRng(7))).toEqual(projectLeagueOrder(w, lid, makeRng(7)));
  });

  it('tends to rank stronger squads higher', () => {
    const w = generateWorld(3);
    const lid = w.countries['CT0'].leagueIds[0];
    // Average projected rank of the top-half-by-strength clubs should beat the bottom half.
    const byStrength = [...w.leagues[lid].clubIds].sort(
      (a, b) => meanRep(w, b) - meanRep(w, a),
    );
    const strong = new Set(byStrength.slice(0, 8));
    let strongRankSum = 0;
    let weakRankSum = 0;
    const trials = 40;
    for (let t = 0; t < trials; t++) {
      projectLeagueOrder(w, lid, makeRng(1000 + t)).forEach((id, rank) => {
        if (strong.has(id)) strongRankSum += rank;
        else weakRankSum += rank;
      });
    }
    expect(strongRankSum).toBeLessThan(weakRankSum); // lower rank index == higher finish
  });
});

function meanRep(w: World, clubId: string): number {
  return w.clubs[clubId].reputation;
}

describe('applyPromotionRelegation', () => {
  it('swaps the relegation band with the promotion band and preserves sizes', () => {
    const w = generateWorld(42);
    const country = w.countries['CT0'];
    const [t1, t2, t3] = country.leagueIds;

    // Use the current club order as each league's "final" standing.
    const orders = {
      [t1]: [...w.leagues[t1].clubIds],
      [t2]: [...w.leagues[t2].clubIds],
      [t3]: [...w.leagues[t3].clubIds],
    };
    const relegatedFromT1 = orders[t1].slice(-SLOTS);
    const promotedFromT2 = orders[t2].slice(0, SLOTS);
    const relegatedFromT2 = orders[t2].slice(-SLOTS);
    const promotedFromT3 = orders[t3].slice(0, SLOTS);

    const out = applyPromotionRelegation(w, country, orders);

    // bottom of tier 1 dropped to tier 2; top of tier 2 climbed to tier 1
    for (const id of relegatedFromT1) expect(w.clubs[id].leagueId).toBe(t2);
    for (const id of promotedFromT2) expect(w.clubs[id].leagueId).toBe(t1);
    // bottom of tier 2 dropped to tier 3; top of tier 3 climbed to tier 2
    for (const id of relegatedFromT2) expect(w.clubs[id].leagueId).toBe(t3);
    for (const id of promotedFromT3) expect(w.clubs[id].leagueId).toBe(t2);

    expect(out.promoted.sort()).toEqual([...promotedFromT2, ...promotedFromT3].sort());
    expect(out.relegated.sort()).toEqual([...relegatedFromT1, ...relegatedFromT2].sort());
    expectCountrySizes(w, 'CT0');
  });

  it('leaves the middle of the table where it is', () => {
    const w = generateWorld(43);
    const country = w.countries['CT0'];
    const [t1] = country.leagueIds;
    const orders = Object.fromEntries(
      country.leagueIds.map((lid) => [lid, [...w.leagues[lid].clubIds]]),
    );
    const safe = orders[t1][Math.floor(CONTENT.CLUBS_PER_LEAGUE / 2)]; // a mid-table club
    applyPromotionRelegation(w, country, orders);
    expect(w.clubs[safe].leagueId).toBe(t1);
  });
});

describe('projectedUserMovement', () => {
  const w = generateWorld(5);
  const [top, mid, bottom] = w.countries['CT0'].leagueIds;
  const size = CONTENT.CLUBS_PER_LEAGUE;

  it('cannot promote out of the top tier', () => {
    expect(projectedUserMovement(w, top, 1)).toBe('stayed');
  });
  it('cannot relegate out of the bottom tier', () => {
    expect(projectedUserMovement(w, bottom, size)).toBe('stayed');
  });
  it('promotes a top finish and relegates a bottom finish in a middle tier', () => {
    expect(projectedUserMovement(w, mid, 1)).toBe('promoted');
    expect(projectedUserMovement(w, mid, SLOTS)).toBe('promoted');
    expect(projectedUserMovement(w, mid, SLOTS + 1)).toBe('stayed');
    expect(projectedUserMovement(w, mid, size)).toBe('relegated');
    expect(projectedUserMovement(w, mid, size - SLOTS + 1)).toBe('relegated');
    expect(projectedUserMovement(w, mid, size - SLOTS)).toBe('stayed');
  });
});

describe('advanceSeason with the pyramid', () => {
  function takeoverIn(leagueId: string, seed: number) {
    const w = generateWorld(seed);
    return createGame(w, {
      leagueId,
      mode: 'takeover',
      takeoverClubId: w.leagues[leagueId].clubIds[0],
    });
  }

  it('moves the user to the tier matching their finish and follows the club', () => {
    const s = takeoverIn('L1', 99); // country 0, tier 2 (a middle tier)
    playFullSeason(s);
    advanceSeason(s);

    const entry = s.history[0];
    expect(entry.tier).toBe(2);
    const newLeagueId = s.world.clubs[s.managedClubId].leagueId;
    // the live season follows the managed club into its new league
    expect(s.season.leagueId).toBe(newLeagueId);
    const newTier = s.world.leagues[newLeagueId].tier;
    if (entry.movement === 'promoted') expect(newTier).toBe(1);
    else if (entry.movement === 'relegated') expect(newTier).toBe(3);
    else expect(newTier).toBe(2);
    // sizes across the whole country are preserved
    expectCountrySizes(s.world, 'CT0');
  });

  it('records the tier and a movement for the played season', () => {
    const s = takeoverIn('L4', 7); // country 1, tier 2
    playFullSeason(s);
    advanceSeason(s);
    const entry = s.history[0];
    expect(entry.leagueId).toBe('L4');
    expect(entry.tier).toBe(2);
    expect(['promoted', 'relegated', 'stayed']).toContain(entry.movement);
    expectCountrySizes(s.world, 'CT1');
  });

  it('is deterministic across identical playthroughs', () => {
    const run = () => {
      const s = takeoverIn('L1', 2024);
      playFullSeason(s);
      advanceSeason(s);
      return s.world.countries['CT0'].leagueIds.map((lid) => s.world.leagues[lid].clubIds);
    };
    expect(JSON.stringify(run())).toEqual(JSON.stringify(run()));
  });
});
