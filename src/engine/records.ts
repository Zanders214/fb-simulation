import type { Club, GameState, Player } from './types';
import { playerValue } from './transfers';

export interface RecordEntry {
  player: Player;
  club: Club;
  /** The stat this row is ranked by (goals, assists, or clean sheets). */
  value: number;
  /** Estimated market value, in thousands. */
  marketValue: number;
}

export interface LeagueRecords {
  topScorers: RecordEntry[];
  topAssisters: RecordEntry[];
  topGoalkeepers: RecordEntry[];
}

function rank(
  players: Player[],
  clubs: Record<string, Club>,
  stat: (p: Player) => number,
  limit: number,
): RecordEntry[] {
  return players
    .filter((p) => stat(p) > 0)
    .sort(
      (a, b) =>
        stat(b) - stat(a) ||
        playerValue(b) - playerValue(a) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit)
    .map((player) => ({
      player,
      club: clubs[player.clubId],
      value: stat(player),
      marketValue: playerValue(player),
    }));
}

/**
 * Top performers in the user's league for the current season: scorers,
 * assisters, and goalkeepers (by clean sheets). Only players belonging to clubs
 * in the managed league are considered. Deterministic ordering (stat desc, then
 * market value desc, then id) so the same save always renders the same tables.
 */
export function leagueRecords(state: GameState, limit = 5): LeagueRecords {
  const league = state.world.leagues[state.season.leagueId];
  const clubIds = new Set(league.clubIds);
  const players = Object.values(state.world.players).filter((p) => clubIds.has(p.clubId));
  const clubs = state.world.clubs;

  return {
    topScorers: rank(players, clubs, (p) => p.seasonGoals, limit),
    topAssisters: rank(players, clubs, (p) => p.seasonAssists, limit),
    topGoalkeepers: rank(
      players.filter((p) => p.position === 'GK'),
      clubs,
      (p) => p.seasonCleanSheets ?? 0,
      limit,
    ),
  };
}
