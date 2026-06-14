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

/**
 * Players currently occupying the manager's training slots, restricted to those
 * still at the club. Training ids are soft references into the squad (like
 * roles), so a player who has left — e.g. been sold — is dropped here rather
 * than stranding a slot. Order follows `trainingIds`.
 */
export function trainingPlayers(game: GameState): Player[] {
  const owned = new Set(userClub(game).playerIds);
  return (game.squad.trainingIds ?? [])
    .filter((id) => owned.has(id))
    .map((id) => game.world.players[id])
    .filter(Boolean);
}

export const POSITION_ORDER = POS_ORDER;
