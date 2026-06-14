import { MARKET, SAVE_VERSION } from './config';
import { generateFixtures } from './fixtures';
import { applyMatchProgression, applySeasonEnd, applyTrainingProgression } from './progression';
import { hashSeed, makeRng } from './rng';
import { type SimTeam, simulateMatch } from './sim';
import { computeTable } from './standings';
import type {
  ClubId,
  Fixture,
  GameState,
  LeagueId,
  MatchResult,
  Season,
  SquadConfig,
  TableRow,
  World,
} from './types';
import { clubBudget, matchIncome, type MatchOutcome, seasonPrize } from './transfers';
import { autoPickSquad } from './world';

export interface NewGameOptions {
  leagueId: LeagueId;
  mode: 'takeover' | 'create';
  /** for 'takeover' */
  takeoverClubId?: ClubId;
  /** for 'create' — a brand-new club that takes the weakest slot in the league */
  newClub?: { name: string; shortName: string; primaryColor: string; secondaryColor: string };
}

function totalMatchdaysFor(world: World, leagueId: LeagueId): number {
  return (world.leagues[leagueId].clubIds.length - 1) * 2;
}

/**
 * Finalise a new game. NOTE: in 'create' mode this mutates the passed `world`
 * (it overwrites the weakest club's identity with the user's club), so callers
 * should pass a world they own. Returns a ready-to-play GameState.
 */
export function createGame(world: World, opts: NewGameOptions): GameState {
  let managedClubId: ClubId;

  if (opts.mode === 'takeover') {
    if (!opts.takeoverClubId) throw new Error('takeover mode requires takeoverClubId');
    managedClubId = opts.takeoverClubId;
    world.clubs[managedClubId].isUserClub = true;
  } else {
    if (!opts.newClub) throw new Error('create mode requires newClub');
    const league = world.leagues[opts.leagueId];
    const weakest = league.clubIds.map((id) => world.clubs[id]).sort((a, b) => a.reputation - b.reputation)[0];
    weakest.name = opts.newClub.name;
    weakest.shortName = opts.newClub.shortName;
    weakest.primaryColor = opts.newClub.primaryColor;
    weakest.secondaryColor = opts.newClub.secondaryColor;
    weakest.isUserClub = true;
    managedClubId = weakest.id;
  }

  const squad = autoPickSquad(world, managedClubId);
  const fixtures = generateFixtures(world.leagues[opts.leagueId].clubIds, world.seed, 1);
  const season: Season = {
    number: 1,
    leagueId: opts.leagueId,
    fixtures,
    currentMatchday: 1,
    totalMatchdays: totalMatchdaysFor(world, opts.leagueId),
  };

  return {
    saveVersion: SAVE_VERSION,
    world,
    managedClubId,
    squad,
    season,
    history: [],
    createdAtSeed: world.seed,
  };
}

function simTeamFor(
  world: World,
  clubId: ClubId,
  managedClubId: ClubId,
  managedSquad: SquadConfig,
  homeAdvantage: boolean,
): SimTeam {
  const squad = clubId === managedClubId ? managedSquad : autoPickSquad(world, clubId);
  const players = squad.startingXI.map((id) => world.players[id]).filter(Boolean);
  return { clubId, players, roles: squad.roles, homeAdvantage };
}

export interface MatchdayOutcome {
  results: MatchResult[];
  userResult?: MatchResult;
  /** Match income the managed club earned this matchday, in thousands. */
  userEarnings?: number;
}

/** The result, from the perspective of the team that scored `my` against `opp`. */
function outcomeFor(my: number, opp: number): MatchOutcome {
  if (my > opp) return 'win';
  if (my < opp) return 'loss';
  return 'draw';
}

/** Credit each club its match income (win/draw/loss), in place. */
function awardMatchIncome(world: World, result: MatchResult): void {
  const { homeClubId, awayClubId, homeGoals, awayGoals } = result;
  world.clubs[homeClubId].budget = clubBudget(world, homeClubId) + matchIncome(outcomeFor(homeGoals, awayGoals));
  world.clubs[awayClubId].budget = clubBudget(world, awayClubId) + matchIncome(outcomeFor(awayGoals, homeGoals));
}

/** Match income the managed club earns from one of its own results, in thousands. */
function userMatchEarnings(managedClubId: ClubId, result: MatchResult): number {
  const isHome = result.homeClubId === managedClubId;
  const my = isHome ? result.homeGoals : result.awayGoals;
  const opp = isHome ? result.awayGoals : result.homeGoals;
  return matchIncome(outcomeFor(my, opp));
}

/** Apply post-match development to one team's players, tracking who featured. */
function applyTeamProgression(
  world: World,
  team: SimTeam,
  conceded: number,
  training: Set<string>,
  played: Set<string>,
  result: MatchResult,
): void {
  const cleanSheet = conceded === 0;
  for (const p of team.players) {
    const r = result.ratings[p.id];
    if (!r) continue;
    const player = world.players[p.id];
    applyMatchProgression(player, r, { inTraining: training.has(p.id), cleanSheet });
    played.add(p.id);
    if (p.position === 'GK' && cleanSheet) {
      player.seasonCleanSheets = (player.seasonCleanSheets ?? 0) + 1;
    }
  }
}

/**
 * Simulate every fixture of the current matchday (including the user's),
 * applying per-player progression to everyone who played, and advance the
 * matchday counter. Mutates `state` in place (and returns the outcome).
 */
export function playMatchday(state: GameState): MatchdayOutcome {
  const { world, season } = state;
  const md = season.currentMatchday;
  const results: MatchResult[] = [];
  let userResult: MatchResult | undefined;
  let userEarnings: number | undefined;
  if (md > season.totalMatchdays) return { results };

  // Only the user's club has training slots; AI players never appear in this set.
  const training = new Set(state.squad.trainingIds ?? []);
  const played = new Set<string>();
  const fixtures = season.fixtures.filter((f) => f.matchday === md);
  fixtures.forEach((f, i) => {
    const rng = makeRng(hashSeed(world.seed, season.number, md, i));
    const home = simTeamFor(world, f.homeClubId, state.managedClubId, state.squad, true);
    const away = simTeamFor(world, f.awayClubId, state.managedClubId, state.squad, false);
    const result = simulateMatch({ home, away, rng });
    f.result = result;
    results.push(result);
    awardMatchIncome(world, result);
    if (f.homeClubId === state.managedClubId || f.awayClubId === state.managedClubId) {
      userResult = result;
      userEarnings = userMatchEarnings(state.managedClubId, result);
    }
    applyTeamProgression(world, home, result.awayGoals, training, played, result);
    applyTeamProgression(world, away, result.homeGoals, training, played, result);
  });

  // Training-slot players who didn't feature still develop on the training ground.
  for (const id of training) {
    if (played.has(id)) continue;
    const player = world.players[id];
    if (player) applyTrainingProgression(player);
  }

  season.currentMatchday = md + 1;
  return { results, userResult, userEarnings };
}

export function isSeasonComplete(state: GameState): boolean {
  return state.season.currentMatchday > state.season.totalMatchdays;
}

/**
 * Roll over to the next season: record champion + the user's finishing
 * position, age & decline every player, regenerate fixtures, and reset the
 * table. Squads and player development carry over. Mutates and returns `state`.
 */
export function advanceSeason(state: GameState): GameState {
  const { world, season } = state;
  const clubIds = world.leagues[season.leagueId].clubIds;
  const table = computeTable(season, clubIds);
  const championClubId = table[0]?.clubId ?? state.managedClubId;
  const userPosition = table.findIndex((r) => r.clubId === state.managedClubId) + 1;
  state.history.push({ season: season.number, championClubId, userPosition });

  for (const id of Object.keys(world.players)) applySeasonEnd(world.players[id]);

  // End-of-season income. Clubs in the played league earn a position-based prize;
  // every other club gets a flat top-up so the wider transfer market stays liquid.
  const positionById = new Map(table.map((r, i) => [r.clubId, i + 1]));
  for (const id of Object.keys(world.clubs)) {
    const club = world.clubs[id];
    const position = positionById.get(id);
    const income =
      position === undefined
        ? MARKET.SEASON_INCOME_BASE + Math.max(0, club.reputation - 40) * MARKET.SEASON_INCOME_REP
        : seasonPrize(position, clubIds.length);
    club.budget = clubBudget(world, id) + income;
  }

  const newNumber = season.number + 1;
  state.season = {
    number: newNumber,
    leagueId: season.leagueId,
    fixtures: generateFixtures(clubIds, world.seed, newNumber),
    currentMatchday: 1,
    totalMatchdays: totalMatchdaysFor(world, season.leagueId),
  };
  return state;
}

// ---- selectors ----

export function leagueTable(state: GameState): TableRow[] {
  return computeTable(state.season, state.world.leagues[state.season.leagueId].clubIds);
}

export function nextUserFixture(state: GameState): Fixture | undefined {
  return state.season.fixtures.find(
    (f) =>
      !f.result &&
      (f.homeClubId === state.managedClubId || f.awayClubId === state.managedClubId),
  );
}

export function fixturesForMatchday(state: GameState, matchday: number): Fixture[] {
  return state.season.fixtures.filter((f) => f.matchday === matchday);
}
