import { generateWorld } from '../../engine/content';
import { createGame } from '../../engine/season';
import type { GameState } from '../../engine/types';
import { trainingPlayers } from '../selectors';

function newTakeover(seed = 7): GameState {
  const w = generateWorld(seed);
  return createGame(w, { leagueId: 'L0', mode: 'takeover', takeoverClubId: w.leagues['L0'].clubIds[0] });
}

describe('trainingPlayers', () => {
  it('lists the players in the training slots', () => {
    const game = newTakeover();
    const [a, b] = game.squad.startingXI;
    game.squad.trainingIds = [a, b];
    expect(trainingPlayers(game).map((p) => p.id)).toEqual([a, b]);
  });

  it('drops a training id for a player who has left the club (no stranded slot)', () => {
    const game = newTakeover();
    const ownedId = game.squad.startingXI[0];
    const foreignId = Object.values(game.world.players).find((p) => p.clubId !== game.managedClubId)!.id;
    // simulate a stale reference: a sold player still listed in a training slot
    game.squad.trainingIds = [ownedId, foreignId];

    const ids = trainingPlayers(game).map((p) => p.id);
    expect(ids).toEqual([ownedId]);
    expect(ids).not.toContain(foreignId);
  });
});
