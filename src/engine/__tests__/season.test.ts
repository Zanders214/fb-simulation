import { generateWorld } from '../content';
import {
  advanceSeason,
  createGame,
  isSeasonComplete,
  leagueTable,
  playMatchday,
} from '../season';
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
