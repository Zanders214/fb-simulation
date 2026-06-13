import { generateWorld } from '../content';
import { leagueRecords } from '../records';
import { createGame, isSeasonComplete, playMatchday } from '../season';
import type { GameState } from '../types';

function freshTakeover(seed = 2026): GameState {
  const w = generateWorld(seed);
  const leagueId = 'L0';
  const takeoverClubId = w.leagues[leagueId].clubIds[0];
  return createGame(w, { leagueId, mode: 'takeover', takeoverClubId });
}

function playFullSeason(s: GameState) {
  let guard = 0;
  while (!isSeasonComplete(s) && guard++ < 100) playMatchday(s);
}

describe('leagueRecords', () => {
  it('returns empty tables before any match is played', () => {
    const s = freshTakeover();
    const r = leagueRecords(s);
    expect(r.topScorers).toHaveLength(0);
    expect(r.topAssisters).toHaveLength(0);
    expect(r.topGoalkeepers).toHaveLength(0);
  });

  it('ranks scorers, assisters and goalkeepers after a season', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const r = leagueRecords(s, 5);

    expect(r.topScorers.length).toBeGreaterThan(0);
    expect(r.topScorers.length).toBeLessThanOrEqual(5);
    expect(r.topAssisters.length).toBeGreaterThan(0);
    expect(r.topGoalkeepers.length).toBeGreaterThan(0);

    // sorted descending by the relevant stat
    for (let i = 1; i < r.topScorers.length; i++) {
      expect(r.topScorers[i - 1].value).toBeGreaterThanOrEqual(r.topScorers[i].value);
    }
    for (let i = 1; i < r.topGoalkeepers.length; i++) {
      expect(r.topGoalkeepers[i - 1].value).toBeGreaterThanOrEqual(r.topGoalkeepers[i].value);
    }

    // goalkeeper table only contains GKs, with a positive clean-sheet count
    for (const e of r.topGoalkeepers) {
      expect(e.player.position).toBe('GK');
      expect(e.value).toBeGreaterThan(0);
    }

    // each entry carries its club and a sane market value
    for (const e of r.topScorers) {
      expect(e.club).toBeDefined();
      expect(e.marketValue).toBeGreaterThan(0);
      expect(e.value).toBe(e.player.seasonGoals);
    }
  });

  it('only includes players from the managed league', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const leagueClubs = new Set(s.world.leagues[s.season.leagueId].clubIds);
    const r = leagueRecords(s);
    for (const group of [r.topScorers, r.topAssisters, r.topGoalkeepers]) {
      for (const e of group) {
        expect(leagueClubs.has(e.player.clubId)).toBe(true);
      }
    }
  });

  it('credits clean sheets that reset at season end', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const totalCS = Object.values(s.world.players).reduce(
      (sum, p) => sum + (p.seasonCleanSheets ?? 0),
      0,
    );
    expect(totalCS).toBeGreaterThan(0);
  });
});
