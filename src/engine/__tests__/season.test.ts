import { overall } from '../attrs';
import { generateWorld } from '../content';
import {
  advanceSeason,
  createGame,
  isSeasonComplete,
  leagueTable,
  playMatchday,
} from '../season';
import { clubRanking } from '../ranking';
import { computeTable } from '../standings';
import { clubBudget, transferPlayer } from '../transfers';
import { isPlayableXI } from '../world';

function freshTakeover(seed = 2026) {
  const w = generateWorld(seed);
  const leagueId = 'L0';
  const takeoverClubId = w.leagues[leagueId].clubIds[0];
  return createGame(w, { leagueId, mode: 'takeover', takeoverClubId });
}

function playFullSeason(s: ReturnType<typeof freshTakeover>) {
  let guard = 0;
  while (!isSeasonComplete(s) && guard++ < 100) playMatchday(s);
}

describe('season', () => {
  it('creates a playable takeover game', () => {
    const s = freshTakeover();
    expect(s.squad.startingXI.length).toBe(11);
    expect(isPlayableXI(s.world, s.squad, s.managedClubId)).toBe(true);
    expect(s.season.fixtures.length).toBe(16 * 15);
    expect(s.season.totalMatchdays).toBe(30);
  });

  it('creates a brand-new user club in create mode', () => {
    const w = generateWorld(7);
    const s = createGame(w, {
      leagueId: 'L0',
      mode: 'create',
      newClub: { name: 'My FC', shortName: 'MFC', primaryColor: '#ffffff', secondaryColor: '#000000' },
    });
    expect(w.clubs[s.managedClubId].name).toBe('My FC');
    expect(w.clubs[s.managedClubId].isUserClub).toBe(true);
    expect(s.world.leagues['L0'].clubIds.length).toBe(16); // league size unchanged
  });

  it('plays a full season to completion with a complete table', () => {
    const s = freshTakeover();
    playFullSeason(s);
    expect(isSeasonComplete(s)).toBe(true);
    const table = leagueTable(s);
    expect(table.length).toBe(16);
    for (const row of table) expect(row.played).toBe(30);
    // total goals for == total goals against across the league
    const gf = table.reduce((a, r) => a + r.gf, 0);
    const ga = table.reduce((a, r) => a + r.ga, 0);
    expect(gf).toBe(ga);
    expect(table[0].points).toBeGreaterThan(0);
  });

  it('is fully deterministic across identical playthroughs', () => {
    const a = freshTakeover(99);
    const b = freshTakeover(99);
    playFullSeason(a);
    playFullSeason(b);
    expect(JSON.stringify(leagueTable(a))).toEqual(JSON.stringify(leagueTable(b)));
  });

  it('advances seasons: ages players, regenerates fixtures, records the champion', () => {
    const s = freshTakeover(5);
    const samplePlayerId = s.world.clubs[s.managedClubId].playerIds[0];
    const ageBefore = s.world.players[samplePlayerId].age;
    playFullSeason(s);
    advanceSeason(s);
    expect(s.season.number).toBe(2);
    expect(s.season.currentMatchday).toBe(1);
    expect(s.season.fixtures.some((f) => f.result)).toBe(false); // fresh fixtures
    expect(s.history.length).toBe(1);
    expect(s.history[0].championClubId).toBeDefined();
    expect(s.world.players[samplePlayerId].age).toBe(ageBefore + 1);
  });

  it('credits clean sheets to defenders as well as keepers (season + career)', () => {
    const s = freshTakeover(3);
    playFullSeason(s);
    const defs = Object.values(s.world.players).filter(
      (p) => p.position === 'DEF' && (p.careerCleanSheets ?? 0) > 0,
    );
    expect(defs.length).toBeGreaterThan(0);
    // outfield non-defenders never earn clean sheets
    for (const p of Object.values(s.world.players)) {
      if (p.position === 'MID' || p.position === 'FWD') {
        expect(p.careerCleanSheets ?? 0).toBe(0);
      }
      // career is at least the current season's tally
      expect(p.careerCleanSheets ?? 0).toBeGreaterThanOrEqual(p.seasonCleanSheets ?? 0);
    }
  });

  it('accumulates career apps and career clean sheets across seasons', () => {
    const s = freshTakeover(8);
    const id = s.squad.startingXI[0]; // a regular who actually features
    playFullSeason(s);
    const appsAfterOne = s.world.players[id].careerApps;
    expect(appsAfterOne).toBeGreaterThan(0);
    const csAfterOne = s.world.players[id].careerCleanSheets;
    advanceSeason(s);
    // season counters reset, career totals carry over
    expect(s.world.players[id].seasonApps).toBe(0);
    expect(s.world.players[id].seasonCleanSheets).toBe(0);
    expect(s.world.players[id].careerCleanSheets).toBe(csAfterOne);
    playFullSeason(s);
    expect(s.world.players[id].careerApps).toBeGreaterThan(appsAfterOne);
  });

  it('latches every active player\'s peak market value', () => {
    const s = freshTakeover(4);
    playFullSeason(s);
    const played = Object.values(s.world.players).filter((p) => p.careerApps > 0);
    expect(played.length).toBeGreaterThan(0);
    for (const p of played) expect(p.peakValue).toBeGreaterThan(0);
  });

  it('records an all-time club contribution ledger that survives a transfer', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    const club = s.world.clubs[s.managedClubId];
    const log = club.playerContributions ?? {};
    const scorerId = Object.keys(log).find((id) => log[id].goals > 0);
    expect(scorerId).toBeDefined();

    // selling/transferring the scorer away leaves his tally on our record
    const goalsBefore = log[scorerId!].goals;
    const otherClub = s.world.leagues[s.season.leagueId].clubIds.find((c) => c !== s.managedClubId)!;
    transferPlayer(s.world, scorerId!, otherClub);
    expect(s.world.players[scorerId!].clubId).toBe(otherClub);
    expect(club.playerContributions?.[scorerId!].goals).toBe(goalsBefore);
  });

  it('pays both clubs match income and reports the user earnings', () => {
    const s = freshTakeover(5);
    const md1 = s.season.fixtures.filter((f) => f.matchday === 1);
    const budgets0 = new Map(Object.keys(s.world.clubs).map((id) => [id, clubBudget(s.world, id)]));

    const outcome = playMatchday(s);

    // every club that played this matchday earned something
    for (const f of md1) {
      expect(clubBudget(s.world, f.homeClubId)).toBeGreaterThan(budgets0.get(f.homeClubId)!);
      expect(clubBudget(s.world, f.awayClubId)).toBeGreaterThan(budgets0.get(f.awayClubId)!);
    }
    // the user's club earned exactly the reported amount
    expect(outcome.userEarnings).toBeGreaterThan(0);
    expect(clubBudget(s.world, s.managedClubId)).toBe(
      budgets0.get(s.managedClubId)! + outcome.userEarnings!,
    );
  });

  it('updates rankings after each match: zero-sum, and the winner rises', () => {
    const s = freshTakeover(5);
    const before = new Map(Object.keys(s.world.clubs).map((id) => [id, clubRanking(s.world, id)]));

    const outcome = playMatchday(s);

    for (const res of outcome.results) {
      const homeDelta = clubRanking(s.world, res.homeClubId) - before.get(res.homeClubId)!;
      const awayDelta = clubRanking(s.world, res.awayClubId) - before.get(res.awayClubId)!;
      expect(homeDelta + awayDelta).toBeCloseTo(0, 6); // zero-sum
      if (res.homeGoals > res.awayGoals) expect(homeDelta).toBeGreaterThan(0);
      if (res.awayGoals > res.homeGoals) expect(awayDelta).toBeGreaterThan(0);
    }
  });

  it('nudges rankings by final league position at season end', () => {
    const s = freshTakeover(5);
    playFullSeason(s);
    const table = leagueTable(s);
    const champion = table[0].clubId;
    const wooden = table[table.length - 1].clubId;
    const champBefore = clubRanking(s.world, champion);
    const woodenBefore = clubRanking(s.world, wooden);

    advanceSeason(s);

    expect(clubRanking(s.world, champion)).toBeGreaterThan(champBefore);
    expect(clubRanking(s.world, wooden)).toBeLessThan(woodenBefore);
  });

  it('rewards a higher league finish with a bigger end-of-season prize', () => {
    const s = freshTakeover(5);
    playFullSeason(s);
    const table = leagueTable(s);
    const champion = table[0].clubId;
    const wooden = table[table.length - 1].clubId;
    const champ0 = clubBudget(s.world, champion);
    const wooden0 = clubBudget(s.world, wooden);

    advanceSeason(s);

    expect(clubBudget(s.world, champion) - champ0).toBeGreaterThan(
      clubBudget(s.world, wooden) - wooden0,
    );
  });

  it('keeps all attributes within 1..99 after a full season of progression', () => {
    const s = freshTakeover(11);
    playFullSeason(s);
    for (const p of Object.values(s.world.players)) {
      for (const k of ['attacking', 'defending', 'midfield'] as const) {
        const v = p.attrs[k] as number;
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('accumulates yellow and red cards into season and career totals', () => {
    const s = freshTakeover(3);
    playFullSeason(s);

    const booked = Object.values(s.world.players).filter((p) => (p.seasonYellowCards ?? 0) > 0);
    expect(booked.length).toBeGreaterThan(0);
    // a full league season produces at least one sending-off somewhere
    const reds = Object.values(s.world.players).reduce((a, p) => a + (p.seasonRedCards ?? 0), 0);
    expect(reds).toBeGreaterThan(0);
    // career totals are always at least the current season's tally
    for (const p of Object.values(s.world.players)) {
      expect(p.careerYellowCards ?? 0).toBeGreaterThanOrEqual(p.seasonYellowCards ?? 0);
      expect(p.careerRedCards ?? 0).toBeGreaterThanOrEqual(p.seasonRedCards ?? 0);
    }
  });

  it('resets season cards but carries career cards across a season rollover', () => {
    const s = freshTakeover(8);
    playFullSeason(s);
    const booked = Object.values(s.world.players).find((p) => (p.seasonYellowCards ?? 0) > 0)!;
    const careerBefore = booked.careerYellowCards ?? 0;
    expect(careerBefore).toBeGreaterThan(0);

    advanceSeason(s);
    expect(booked.seasonYellowCards).toBe(0);
    expect(booked.seasonRedCards).toBe(0);
    expect(booked.careerYellowCards).toBe(careerBefore);
  });

  it('sidelines an injured starter, backfills the XI, and heals him over time', () => {
    const s = freshTakeover(12);
    const starter = s.squad.startingXI[5];
    s.world.players[starter].injuredMatches = 2;

    const outcome = playMatchday(s);
    const r = outcome.userResult!;
    expect(r).toBeDefined();
    // the injured starter didn't feature, so he has no rating in the result
    expect(r.ratings[starter]).toBeUndefined();
    // the user still STARTED a full XI — a fit reserve came in (subs add more on top)
    const subbedOn = new Set(r.subs.filter((su) => su.clubId === s.managedClubId).map((su) => su.onPlayerId));
    const started = Object.keys(r.ratings).filter(
      (id) => s.world.clubs[s.managedClubId].playerIds.includes(id) && !subbedOn.has(id),
    );
    expect(started.length).toBe(11);
    // the absence ticks down one matchday at a time (he wasn't hurt this matchday)
    expect(s.world.players[starter].injuredMatches).toBe(1);

    playMatchday(s);
    expect(s.world.players[starter].injuredMatches).toBe(0); // fit again
  });

  it('replaces an injured starter with the best fit reserve of the same position', () => {
    const s = freshTakeover(12);
    const inXI = new Set(s.squad.startingXI);
    const starterFwd = s.squad.startingXI
      .map((id) => s.world.players[id])
      .find((p) => p.position === 'FWD')!;
    // the club's fit forward reserves (all fit on matchday 1)
    const reserveFwds = s.world.clubs[s.managedClubId].playerIds
      .map((id) => s.world.players[id])
      .filter((p) => p.position === 'FWD' && !inXI.has(p.id));
    expect(reserveFwds.length).toBeGreaterThan(0);
    const bestOverall = Math.max(...reserveFwds.map(overall));

    s.world.players[starterFwd.id].injuredMatches = 1;
    const r = playMatchday(s).userResult!;

    // the injured forward sat out; the best reserve forward STARTED in his place
    // (others may appear as in-match subs, so look only at who started)
    expect(r.ratings[starterFwd.id]).toBeUndefined();
    const subbedOn = new Set(r.subs.filter((su) => su.clubId === s.managedClubId).map((su) => su.onPlayerId));
    const startedReserveFwds = reserveFwds.filter((p) => r.ratings[p.id] && !subbedOn.has(p.id));
    expect(startedReserveFwds.length).toBe(1);
    expect(overall(startedReserveFwds[0])).toBe(bestOverall);
  });

  it('records substitute appearances separately from starts, and carries them across seasons', () => {
    const s = freshTakeover(4);
    playFullSeason(s);

    const subbed = Object.values(s.world.players).filter((p) => (p.seasonSubApps ?? 0) > 0);
    expect(subbed.length).toBeGreaterThan(0); // players came off the bench
    // every player's career totals are at least the current season's
    for (const p of Object.values(s.world.players)) {
      expect(p.careerSubApps ?? 0).toBeGreaterThanOrEqual(p.seasonSubApps ?? 0);
      expect(p.careerApps ?? 0).toBeGreaterThanOrEqual(p.seasonApps);
    }

    const sample = subbed[0];
    const careerSubBefore = sample.careerSubApps;
    advanceSeason(s);
    expect(sample.seasonSubApps).toBe(0); // season tally resets
    expect(sample.careerSubApps).toBe(careerSubBefore); // career tally carries over
  });

  it('injures players over a season and never leaves an absence stuck negative', () => {
    const s = freshTakeover(5);
    playFullSeason(s);
    for (const p of Object.values(s.world.players)) {
      expect(p.injuredMatches ?? 0).toBeGreaterThanOrEqual(0);
      expect(p.suspendedMatches ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('world-wide simulation', () => {
  it('schedules every other league at game start', () => {
    const s = freshTakeover();
    const leagueIds = Object.keys(s.world.leagues);
    const otherIds = Object.keys(s.season.otherFixtures);
    expect(otherIds.sort()).toEqual(leagueIds.filter((l) => l !== s.season.leagueId).sort());
    for (const lid of otherIds) expect(s.season.otherFixtures[lid].length).toBe(16 * 15);
  });

  it('develops players in other leagues and keeps only a slim score there', () => {
    const s = freshTakeover();
    const otherLid = Object.keys(s.season.otherFixtures)[0];
    const sampleClub = s.world.leagues[otherLid].clubIds[0];
    const apps = () =>
      s.world.clubs[sampleClub].playerIds.reduce((a, id) => a + s.world.players[id].seasonApps, 0);

    const before = apps();
    playMatchday(s);
    expect(apps()).toBeGreaterThan(before); // a club in another league actually played

    const md1 = s.season.otherFixtures[otherLid].filter((f) => f.matchday === 1);
    expect(md1.length).toBe(8);
    for (const f of md1) {
      expect(f.score).toBeDefined(); // table-ready
      expect(f.result).toBeUndefined(); // but no heavy result is retained
    }
  });

  it('builds complete real tables for other leagues over a full season', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const otherLid = Object.keys(s.season.otherFixtures)[0];
    const table = computeTable(s.season.otherFixtures[otherLid], s.world.leagues[otherLid].clubIds);
    expect(table.length).toBe(16);
    for (const row of table) expect(row.played).toBe(30);
    expect(table.reduce((a, r) => a + r.gf, 0)).toBe(table.reduce((a, r) => a + r.ga, 0));
  });

  it('runs promotion and relegation in every country, not just the user’s', () => {
    const s = freshTakeover();
    const userCountryId = s.world.leagues[s.season.leagueId].countryId;
    const userCountryLeagues = new Set(s.world.countries[userCountryId].leagueIds);
    const before = new Map(Object.values(s.world.clubs).map((c) => [c.id, c.leagueId]));

    playFullSeason(s);
    advanceSeason(s);

    const movedOutsideUserCountry = Object.values(s.world.clubs).filter(
      (c) => c.leagueId !== before.get(c.id) && !userCountryLeagues.has(before.get(c.id) as string),
    );
    expect(movedOutsideUserCountry.length).toBeGreaterThan(0);
  });
});
