import { generateWorld } from '../content';
import {
  advanceSeason,
  createGame,
  isSeasonComplete,
  leagueTable,
  playMatchday,
} from '../season';
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
});
