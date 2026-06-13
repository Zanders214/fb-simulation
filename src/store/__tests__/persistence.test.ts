import { generateWorld } from '../../engine/content';
import { createGame, isSeasonComplete, leagueTable, playMatchday } from '../../engine/season';
import type { GameState } from '../../engine/types';

const roundTrip = (game: GameState): GameState => JSON.parse(JSON.stringify(game));

function newTakeover(seed: number): GameState {
  const w = generateWorld(seed);
  return createGame(w, { leagueId: 'L0', mode: 'takeover', takeoverClubId: w.leagues['L0'].clubIds[0] });
}

describe('save persistence (JSON round-trip)', () => {
  it('stamps a save version', () => {
    expect(newTakeover(1).saveVersion).toBeGreaterThanOrEqual(1);
  });

  it('a game survives serialization and stays playable', () => {
    const game = newTakeover(4242);
    const restored = roundTrip(game);
    expect(restored.managedClubId).toBe(game.managedClubId);
    expect(restored.squad.startingXI).toEqual(game.squad.startingXI);
    expect(Object.keys(restored.world.players).length).toBe(Object.keys(game.world.players).length);
    expect(playMatchday(restored).results.length).toBeGreaterThan(0);
  });

  it('reloading mid-season reproduces identical subsequent results', () => {
    const live = newTakeover(77);
    for (let i = 0; i < 10; i++) playMatchday(live);

    // snapshot the save at matchday 11, then finish both copies independently
    const reloaded = roundTrip(live);
    while (!isSeasonComplete(live)) playMatchday(live);
    while (!isSeasonComplete(reloaded)) playMatchday(reloaded);

    expect(JSON.stringify(leagueTable(reloaded))).toEqual(JSON.stringify(leagueTable(live)));
  });
});
