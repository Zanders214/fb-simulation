import {
  clubBudget,
  leagueRecords,
  leagueTable,
  MARKET,
  nextUserFixture,
  type Club,
  type GameState,
  type RecentResult,
  type TableRow,
} from '../../engine';

/** One row of the Home mini-standings window. */
export interface HomeStandingRow {
  rank: number; // 1-based league position
  club: Club;
  points: number;
  gd: number;
  isUser: boolean;
}

/** Everything the matchday Home dashboard renders, derived from the live game. */
export interface HomeData {
  club: Club;
  leagueName: string;
  seasonNumber: number;
  /** The matchday about to be played (or the current one at season end). */
  matchday: number;
  totalMatchdays: number;
  /** Next opponent + venue; absent once the season is complete. */
  opponent?: Club;
  isHome: boolean;
  /** League position (1-based; 0 if the club isn't found). */
  position: number;
  points: number;
  gd: number;
  /** Recent W/D/L, oldest-first, capped to the last five. */
  form: RecentResult[];
  topScorerName?: string;
  topScorerGoals: number;
  budget: number; // thousands
  squadSize: number;
  squadCap: number;
  /** Up to four standings rows that always include the user's club. */
  standingsWindow: HomeStandingRow[];
}

/** Slice up to `size` rows that always include the user (shown with one row above where possible). */
function windowAroundUser(rows: HomeStandingRow[], userIdx: number, size: number): HomeStandingRow[] {
  if (rows.length <= size) return rows;
  if (userIdx < 0) return rows.slice(0, size);
  let start = userIdx - 1;
  if (start < 0) start = 0;
  if (start + size > rows.length) start = rows.length - size;
  return rows.slice(start, start + size);
}

export function buildHomeData(game: GameState): HomeData {
  const me = game.managedClubId;
  const club = game.world.clubs[me];
  const league = game.world.leagues[game.season.leagueId];

  const fixture = nextUserFixture(game);
  let opponent: Club | undefined;
  let isHome = false;
  if (fixture) {
    isHome = fixture.homeClubId === me;
    opponent = game.world.clubs[isHome ? fixture.awayClubId : fixture.homeClubId];
  }

  const table: TableRow[] = leagueTable(game);
  const userIdx = table.findIndex((r) => r.clubId === me);
  const userRow = userIdx >= 0 ? table[userIdx] : undefined;
  const rows: HomeStandingRow[] = table.map((r, i) => ({
    rank: i + 1,
    club: game.world.clubs[r.clubId],
    points: r.points,
    gd: r.gd,
    isUser: r.clubId === me,
  }));

  const topScorer = leagueRecords(game, 5).topScorers[0];

  return {
    club,
    leagueName: league.name,
    seasonNumber: game.season.number,
    matchday: fixture?.matchday ?? game.season.currentMatchday,
    totalMatchdays: game.season.totalMatchdays,
    opponent,
    isHome,
    position: userIdx + 1,
    points: userRow?.points ?? 0,
    gd: userRow?.gd ?? 0,
    form: (club.recentForm ?? []).slice(-5),
    topScorerName: topScorer?.player.name,
    topScorerGoals: topScorer?.value ?? 0,
    budget: clubBudget(game.world, me),
    squadSize: club.playerIds.length,
    squadCap: MARKET.MAX_SQUAD,
    standingsWindow: windowAroundUser(rows, userIdx, 4),
  };
}
