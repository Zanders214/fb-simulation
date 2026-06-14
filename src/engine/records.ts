import type { Club, ClubContribution, GameState, Player } from './types';
import { clubSquadValue, playerValue } from './transfers';

export interface RecordEntry {
  player: Player;
  club: Club;
  /** The stat this row is ranked by (goals, assists, clean sheets, or cards). */
  value: number;
  /** Estimated market value, in thousands. */
  marketValue: number;
  /** Discipline tables only: the yellow/red split that makes up `value`. */
  yellow?: number;
  red?: number;
}

export interface LeagueRecords {
  topScorers: RecordEntry[];
  topAssisters: RecordEntry[];
  topGoalkeepers: RecordEntry[];
  mostCards: RecordEntry[];
}

/** A player's yellow/red tally plus their club, before ranking. */
interface CardRow {
  player: Player;
  club: Club;
  yellow: number;
  red: number;
}

/**
 * Rank a discipline table by total cards (yellow + red), breaking ties on reds
 * first (a sending-off is "worse"), then market value, then id — deterministic.
 * Each entry's `value` is the card total, with the yellow/red split attached.
 */
function rankCards(rows: CardRow[], limit: number): RecordEntry[] {
  return rows
    .filter((r) => r.yellow + r.red > 0)
    .sort(
      (a, b) =>
        b.yellow + b.red - (a.yellow + a.red) ||
        b.red - a.red ||
        playerValue(b.player) - playerValue(a.player) ||
        a.player.id.localeCompare(b.player.id),
    )
    .slice(0, limit)
    .map(({ player, club, yellow, red }) => ({
      player,
      club,
      value: yellow + red,
      marketValue: playerValue(player),
      yellow,
      red,
    }));
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
 * assisters, goalkeepers (by clean sheets), and the most-carded players. Only
 * players belonging to clubs in the managed league are considered. Deterministic
 * ordering (stat desc, then market value desc, then id) so the same save always
 * renders the same tables.
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
    mostCards: rankCards(
      players.map((p) => ({
        player: p,
        club: clubs[p.clubId],
        yellow: p.seasonYellowCards ?? 0,
        red: p.seasonRedCards ?? 0,
      })),
      limit,
    ),
  };
}

export interface ClubStats {
  trophies: number; // league titles won by the club
  seasonsPlayed: number; // completed seasons in this save
  bestFinish: number; // best (lowest) league position, or 0 if none
  squadValue: number; // current total squad value, in thousands
  peakSquadValue: number; // highest-ever total squad value, in thousands
  topScorers: RecordEntry[]; // all-time, while at this club
  topAssisters: RecordEntry[]; // all-time, while at this club
  mostCards: RecordEntry[]; // all-time bookings/sendings-off, while at this club
}

/**
 * All-time totals for a single club. Scorers/assisters come from the club's
 * persistent contribution ledger (goals/assists scored WHILE at the club), so a
 * player who has since been sold still appears — his name is resolved from
 * `world.players`, where players are never deleted. The `club` on each entry is
 * the player's CURRENT club, which may differ if he has moved on. Deterministic
 * ordering (stat desc, then id).
 */
export function clubRecords(state: GameState, clubId = state.managedClubId, limit = 5): ClubStats {
  const { world, history } = state;
  const club = world.clubs[clubId];
  const log = club.playerContributions ?? {};

  const toEntries = (stat: (c: ClubContribution) => number): RecordEntry[] =>
    Object.entries(log)
      .filter(([id, c]) => world.players[id] && stat(c) > 0)
      .sort(([ai, a], [bi, b]) => stat(b) - stat(a) || ai.localeCompare(bi))
      .slice(0, limit)
      .map(([id, c]) => {
        const player = world.players[id];
        return { player, club: world.clubs[player.clubId], value: stat(c), marketValue: playerValue(player) };
      });

  // Cards reuse the same ledger; rank by total cards (reds break ties) and keep
  // the yellow/red split on each entry so the UI can show the breakdown.
  const cardEntries = (): RecordEntry[] =>
    Object.entries(log)
      .filter(([id, c]) => world.players[id] && (c.yellow ?? 0) + (c.red ?? 0) > 0)
      .sort(
        ([ai, a], [bi, b]) =>
          (b.yellow ?? 0) + (b.red ?? 0) - ((a.yellow ?? 0) + (a.red ?? 0)) ||
          (b.red ?? 0) - (a.red ?? 0) ||
          ai.localeCompare(bi),
      )
      .slice(0, limit)
      .map(([id, c]) => {
        const player = world.players[id];
        const yellow = c.yellow ?? 0;
        const red = c.red ?? 0;
        return { player, club: world.clubs[player.clubId], value: yellow + red, marketValue: playerValue(player), yellow, red };
      });

  // `userPosition` in history is the managed club's finish, so a best-finish is
  // only meaningful for that club; other clubs report 0 (rendered as "–").
  const positions = history.map((h) => h.userPosition).filter((p) => p > 0);
  const bestFinish = clubId === state.managedClubId && positions.length ? Math.min(...positions) : 0;
  return {
    trophies: history.filter((h) => h.championClubId === clubId).length,
    seasonsPlayed: history.length,
    bestFinish,
    squadValue: clubSquadValue(world, clubId),
    peakSquadValue: Math.max(club.peakSquadValue ?? 0, clubSquadValue(world, clubId)),
    topScorers: toEntries((c) => c.goals),
    topAssisters: toEntries((c) => c.assists),
    mostCards: cardEntries(),
  };
}
