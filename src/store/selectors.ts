import { overall, type GameState, type Player, type Position } from '../engine';

const POS_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export function clubPlayers(game: GameState, clubId: string): Player[] {
  return game.world.clubs[clubId].playerIds.map((id) => game.world.players[id]).filter(Boolean);
}

/** Group a club's players by position, each group sorted by overall desc. */
export function squadByPosition(game: GameState, clubId: string): { position: Position; players: Player[] }[] {
  const players = clubPlayers(game, clubId);
  return POS_ORDER.map((position) => ({
    position,
    players: players.filter((p) => p.position === position).sort((a, b) => overall(b) - overall(a)),
  }));
}

export function userClub(game: GameState) {
  return game.world.clubs[game.managedClubId];
}

export const POSITION_ORDER = POS_ORDER;
