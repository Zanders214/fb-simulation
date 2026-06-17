import { createGame, generateWorld, playMatchday } from '../../../engine';
import { buildHomeData } from '../homeData';

function newGame(seed = 7) {
  const w = generateWorld(seed);
  return createGame(w, { leagueId: 'L0', mode: 'takeover', takeoverClubId: w.leagues['L0'].clubIds[0] });
}

describe('buildHomeData', () => {
  it('summarises the managed club at the start of a season', () => {
    const game = newGame();
    const d = buildHomeData(game);

    expect(d.club.id).toBe(game.managedClubId);
    expect(d.leagueName.length).toBeGreaterThan(0);
    expect(d.seasonNumber).toBe(game.season.number);
    expect(d.totalMatchdays).toBe(game.season.totalMatchdays);
    expect(d.squadCap).toBe(25);
    expect(d.squadSize).toBeGreaterThan(0);

    // Fresh season: a matchday-1 fixture against a different club, everyone on 0.
    expect(d.opponent).toBeDefined();
    expect(d.opponent?.id).not.toBe(game.managedClubId);
    expect(d.matchday).toBe(1);
    expect(d.points).toBe(0);

    // The standings window always includes the user and is at most four rows.
    expect(d.standingsWindow.length).toBeGreaterThan(0);
    expect(d.standingsWindow.length).toBeLessThanOrEqual(4);
    expect(d.standingsWindow.some((r) => r.isUser)).toBe(true);
    expect(d.position).toBeGreaterThanOrEqual(1);
  });

  it('advances the next fixture and records form after a matchday', () => {
    const game = newGame();
    playMatchday(game);
    const d = buildHomeData(game);

    expect(d.matchday).toBe(2);
    expect(d.form.length).toBeGreaterThanOrEqual(1);
    expect(d.form.length).toBeLessThanOrEqual(5);
    expect(d.position).toBeGreaterThanOrEqual(1);
  });
});
