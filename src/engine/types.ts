/** Core domain types for the football management sim. Pure data, no behaviour. */

export type PlayerId = string;
export type ClubId = string;
export type LeagueId = string;
export type CountryId = string;
export type FixtureId = string;

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

/**
 * Attribute keys. v1 only generates/uses the coarse trio; the rest are reserved
 * so a future, richer stat model can be added WITHOUT a save migration — the
 * `attrs` map is sparse and always read through helpers in `attrs.ts`.
 */
export type AttrKey =
  | 'attacking'
  | 'defending'
  | 'midfield'
  // reserved for later expansion:
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'tackling'
  | 'physical'
  | 'goalkeeping';

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2' | '4-5-1';

export interface Player {
  id: PlayerId;
  clubId: ClubId;
  name: string;
  firstName: string;
  lastName: string;
  nationality: string; // fictional
  age: number;
  position: Position;
  /** Sparse attribute map. v1 fills attacking/defending/midfield (1..99). */
  attrs: Partial<Record<AttrKey, number>>;
  potential: number; // soft growth ceiling, 1..99
  // ---- evolving development state (mutated by progression) ----
  form: number; // -5..+5 EMA of recent ratings, affects the next match only
  growthXp: number; // fractional accumulator; crossing ±1 nudges a stat
  // ---- form-event streaks (0..3 level; read via `?? 0`) ----
  // Consecutive APPEARANCES recording the same event escalate its form swing
  // (L1 ×1, L2 ×1.5, L3 ×2). Climbs when the event repeats, snaps to 0 on a
  // played match without it, cools one level on a missed match.
  goalStreak?: number;
  assistStreak?: number;
  cleanSheetStreak?: number; // GK/DEF only, like clean-sheet form
  yellowStreak?: number; // bookings escalate the form penalty, tracked apart from reds
  redStreak?: number;
  // ---- season counters (reset each season, for UI like top scorers) ----
  seasonGoals: number;
  seasonAssists: number;
  seasonApps: number; // matches STARTED in the first XI
  seasonSubApps: number; // matches come on as a substitute
  seasonCleanSheets: number; // matches a GK finished without conceding
  seasonYellowCards: number; // bookings this season
  seasonRedCards: number; // sendings-off this season
  // ---- career totals (never reset; read via `?? 0` for pre-career saves) ----
  careerGoals: number;
  careerAssists: number;
  careerApps: number; // career starts
  careerSubApps: number; // career substitute appearances
  careerCleanSheets: number; // GK/DEF matches finished without conceding
  careerYellowCards: number;
  careerRedCards: number;
  peakValue: number; // highest market value ever reached, in thousands
  // ---- availability (absent/0 = fully fit and selectable) ----
  /** Matchdays still to be missed through injury; counts down as matchdays play. */
  injuredMatches?: number;
  /** Matchdays still to be missed through suspension (e.g. after a red card). */
  suspendedMatches?: number;
}

/** A player's all-time tally while at a specific club. */
export interface ClubContribution {
  goals: number;
  assists: number;
  yellow?: number; // bookings shown while at this club (read via `?? 0`)
  red?: number; // sendings-off while at this club (read via `?? 0`)
}

export interface Club {
  id: ClubId;
  leagueId: LeagueId;
  name: string;
  shortName: string; // 3-letter code for tables
  reputation: number; // 1..100, drives generated squad strength
  budget: number; // transfer funds, in thousands (e.g. 23400 == €23.4M)
  primaryColor: string;
  secondaryColor: string;
  playerIds: PlayerId[];
  isUserClub?: boolean;
  /** Elo-style strength ranking; rises on wins, falls on losses. Read via `clubRanking`. */
  ranking?: number;
  /** Running max of total squad value, in thousands (read via `?? 0`). */
  peakSquadValue?: number;
  /** All-time goals/assists scored while at this club, keyed by player id. */
  playerContributions?: Record<PlayerId, ClubContribution>;
  /** Recent W/D/L, oldest first, capped to the last few matches (read via `?? []`). */
  recentForm?: RecentResult[];
}

/** A single match result from a club's perspective (compact W/D/L history). */
export type RecentResult = 'W' | 'D' | 'L';

export interface League {
  id: LeagueId;
  name: string;
  country: string; // fictional country name (display); see `countryId` for the link
  countryId: CountryId;
  tier: number; // 1-based; 1 = top division. Promotion moves a club to tier - 1.
  clubIds: ClubId[];
}

/** A fictional country hosting a stacked pyramid of leagues (one per tier). */
export interface Country {
  id: CountryId;
  name: string;
  /** Leagues in this country ordered by tier, top first (`leagueIds[0]` = tier 1). */
  leagueIds: LeagueId[];
}

export interface World {
  seed: number;
  generatorVersion: number;
  countries: Record<CountryId, Country>;
  leagues: Record<LeagueId, League>;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
}

// ---- match results ----

export type GoalType = 'open_play' | 'header' | 'penalty' | 'free_kick';

export interface GoalEvent {
  minute: number; // 1..90
  clubId: ClubId;
  scorerId: PlayerId;
  assistId?: PlayerId;
  type: GoalType;
}

export type CardType = 'yellow' | 'red';

export interface CardEvent {
  minute: number; // 1..90
  clubId: ClubId;
  playerId: PlayerId;
  type: CardType;
  /** A red shown for a second bookable offence (i.e. a second yellow). */
  secondYellow?: boolean;
}

export interface InjuryEvent {
  minute: number; // 1..90
  clubId: ClubId;
  playerId: PlayerId;
  matchesOut: number; // matchdays the player is expected to miss
}

export interface SubEvent {
  minute: number; // 1..90
  clubId: ClubId;
  offPlayerId: PlayerId; // the player coming off
  onPlayerId: PlayerId; // the substitute coming on
}

export interface PlayerRating {
  playerId: PlayerId;
  rating: number; // 1.0..10.0
  goals: number;
  assists: number;
}

export interface TeamMatchStats {
  possession: number; // 0..1
  chances: number;
  xg: number;
  goals: number;
}

export interface MatchResult {
  homeClubId: ClubId;
  awayClubId: ClubId;
  homeGoals: number;
  awayGoals: number;
  events: GoalEvent[]; // sorted by minute asc
  cards: CardEvent[]; // sorted by minute asc
  injuries: InjuryEvent[]; // sorted by minute asc
  subs: SubEvent[]; // sorted by minute asc
  ratings: Record<PlayerId, PlayerRating>;
  stats: { home: TeamMatchStats; away: TeamMatchStats };
}

// ---- season ----

export interface Fixture {
  id: FixtureId;
  matchday: number; // 1-based
  homeClubId: ClubId;
  awayClubId: ClubId;
  /** Full result, kept only for the user's league (powers the match viewer). */
  result?: MatchResult;
  /**
   * Slim final score, stored for non-user leagues instead of the full result:
   * per-player effects are applied immediately during simulation, so only the
   * score is needed afterwards (for the table) and the save stays small.
   */
  score?: { homeGoals: number; awayGoals: number };
}

export interface TableRow {
  clubId: ClubId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface Season {
  number: number; // 1-based
  leagueId: LeagueId;
  fixtures: Fixture[];
  /**
   * Schedules for every OTHER league in the world, keyed by league id. Played in
   * lock-step with the user's league each matchday so every player develops; each
   * fixture carries only a slim `score` (no full result) to keep the save small.
   */
  otherFixtures: Record<LeagueId, Fixture[]>;
  currentMatchday: number; // next matchday to play; > totalMatchdays when finished
  totalMatchdays: number;
}

// ---- the user's tactical setup for their club ----

export interface SquadRoles {
  captainId?: PlayerId;
  freeKickTakerId?: PlayerId;
  penaltyTakerId?: PlayerId;
}

export interface SquadConfig {
  formation: Formation;
  startingXI: PlayerId[]; // length 11
  bench: PlayerId[]; // up to 7
  roles: SquadRoles;
  /** Up to TRAINING.SLOTS players who develop faster after matches. */
  trainingIds?: PlayerId[];
}

// ---- the persisted game ----

export type Movement = 'promoted' | 'relegated' | 'stayed';

export interface SeasonHistoryEntry {
  season: number;
  championClubId: ClubId;
  userPosition: number;
  /** The league the user played that season (added with the division pyramid). */
  leagueId?: LeagueId;
  /** The tier the user played that season (1 = top). */
  tier?: number;
  /** Whether the user was promoted, relegated, or stayed after that season. */
  movement?: Movement;
}

export interface GameState {
  saveVersion: number;
  world: World;
  managedClubId: ClubId;
  squad: SquadConfig;
  season: Season;
  history: SeasonHistoryEntry[];
  createdAtSeed: number; // the seed the world was generated from (reproducibility)
}
