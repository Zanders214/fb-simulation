import { MARKET, SAVE_VERSION } from './config';
import { generateFixtures } from './fixtures';
import { applyMatchProgression, applySeasonEnd, applyTrainingProgression } from './progression';
import { applyPromotionRelegation, projectLeagueOrder } from './promotion';
import { hashSeed, makeRng } from './rng';
import { type SimTeam, simulateMatch } from './sim';
import { computeTable } from './standings';
import type {
  ClubId,
  Country,
  Fixture,
  GameState,
  LeagueId,
  MatchResult,
  Movement,
  Player,
  Season,
  SquadConfig,
  TableRow,
  World,
} from './types';
import { clubBudget, clubSquadValue, matchIncome, type MatchOutcome, playerValue, seasonPrize } from './transfers';
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
  state: GameState,
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
    const player = state.world.players[p.id];
    applyMatchProgression(player, r, { inTraining: training.has(p.id), cleanSheet });
    played.add(p.id);
    recordPlayerMatchStats(state, player, r, cleanSheet);
  }
}

/**
 * Record a played match's lasting stats for one player: clean sheets (keepers &
 * defenders, season + career), the managed club's all-time goal/assist ledger
 * (kept by player id so a sold player's tally survives his departure), and the
 * player's peak market value. Mutates the player and (for the user's club) the
 * club. Season/career counters that the sim already owns are set elsewhere.
 */
function recordPlayerMatchStats(
  state: GameState,
  player: Player,
  r: MatchResult['ratings'][string],
  cleanSheet: boolean,
): void {
  if (cleanSheet && (player.position === 'GK' || player.position === 'DEF')) {
    player.seasonCleanSheets = (player.seasonCleanSheets ?? 0) + 1;
    player.careerCleanSheets = (player.careerCleanSheets ?? 0) + 1;
  }
  if (player.clubId === state.managedClubId && (r.goals > 0 || r.assists > 0)) {
    const club = state.world.clubs[state.managedClubId];
    club.playerContributions ??= {};
    const entry = club.playerContributions[player.id] ?? { goals: 0, assists: 0 };
    entry.goals += r.goals;
    entry.assists += r.assists;
    club.playerContributions[player.id] = entry;
  }
  player.peakValue = Math.max(player.peakValue ?? 0, playerValue(player));
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
    applyTeamProgression(state, home, result.awayGoals, training, played, result);
    applyTeamProgression(state, away, result.homeGoals, training, played, result);
  });

  // Track each club's highest-ever total squad value.
  for (const cid of world.leagues[season.leagueId].clubIds) {
    const club = world.clubs[cid];
    club.peakSquadValue = Math.max(club.peakSquadValue ?? 0, clubSquadValue(world, cid));
  }

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

/** Numeric suffix of a league id (`L7` -> 7), for deriving stable per-league seeds. */
function leagueSeedIndex(leagueId: LeagueId): number {
  return Number(leagueId.slice(1)) || 0;
}

/**
 * Final finishing orders (best → worst) for every league in the user's country:
 * the *real* table for the league they actually played, and a cheap seeded
 * projection for the other tiers (which are never simulated match-by-match).
 */
function countryFinalOrders(
  state: GameState,
  country: Country,
  playedOrder: ClubId[],
): Record<LeagueId, ClubId[]> {
  const { world, season } = state;
  const orders: Record<LeagueId, ClubId[]> = {};
  for (const lid of country.leagueIds) {
    if (lid === season.leagueId) {
      orders[lid] = playedOrder;
    } else {
      const rng = makeRng(hashSeed(world.seed, 9091, season.number, leagueSeedIndex(lid)));
      orders[lid] = projectLeagueOrder(world, lid, rng);
    }
  }
  return orders;
}

/**
 * Run promotion/relegation across the user's country and move the live season to
 * follow the managed club into its new tier. Returns how the user's club moved.
 */
function applyUserCountryPyramid(state: GameState, playedTable: TableRow[]): Movement {
  const { world, season } = state;
  const league = world.leagues[season.leagueId];
  const country = world.countries[league.countryId];
  if (!country) return 'stayed';

  const prevTier = league.tier;
  const orders = countryFinalOrders(state, country, playedTable.map((r) => r.clubId));
  applyPromotionRelegation(world, country, orders);

  const newLeagueId = world.clubs[state.managedClubId].leagueId;
  season.leagueId = newLeagueId;
  const newTier = world.leagues[newLeagueId].tier;
  if (newTier < prevTier) return 'promoted';
  if (newTier > prevTier) return 'relegated';
  return 'stayed';
}

/**
 * Roll over to the next season: record champion + the user's finishing position,
 * age & decline every player, pay end-of-season income, apply promotion /
 * relegation across the user's country (the managed club carries its squad into
 * its new tier), then regenerate fixtures. Squads and development carry over.
 * Mutates and returns `state`.
 */
export function advanceSeason(state: GameState): GameState {
  const { world, season } = state;
  const playedLeagueId = season.leagueId;
  const clubIds = world.leagues[playedLeagueId].clubIds;
  const table = computeTable(season, clubIds);
  const championClubId = table[0]?.clubId ?? state.managedClubId;
  const userPosition = table.findIndex((r) => r.clubId === state.managedClubId) + 1;
  const playedTier = world.leagues[playedLeagueId].tier;

  for (const id of Object.keys(world.players)) applySeasonEnd(world.players[id]);

  // Ageing shifts market values, so re-latch player value peaks.
  for (const id of Object.keys(world.players)) {
    const p = world.players[id];
    p.peakValue = Math.max(p.peakValue ?? 0, playerValue(p));
  }

  // End-of-season income, on the league membership that was just played. Clubs in
  // the played league earn a position-based prize; every other club gets a flat
  // top-up so the wider transfer market stays liquid.
  const positionById = new Map(table.map((r, i) => [r.clubId, i + 1]));
  for (const id of Object.keys(world.clubs)) {
    const club = world.clubs[id];
    const position = positionById.get(id);
    const income =
      position === undefined
        ? MARKET.SEASON_INCOME_BASE + Math.max(0, club.reputation - 40) * MARKET.SEASON_INCOME_REP
        : seasonPrize(position, clubIds.length);
    club.budget = clubBudget(world, id) + income;
    club.peakSquadValue = Math.max(club.peakSquadValue ?? 0, clubSquadValue(world, id));
  }

  // Promotion / relegation (mutates leagues + the managed club's tier), then
  // record the season just played with the user's resulting movement.
  const movement = applyUserCountryPyramid(state, table);
  state.history.push({
    season: season.number,
    championClubId,
    userPosition,
    leagueId: playedLeagueId,
    tier: playedTier,
    movement,
  });

  const newNumber = season.number + 1;
  const newLeagueId = season.leagueId; // updated by the pyramid if the user moved
  state.season = {
    number: newNumber,
    leagueId: newLeagueId,
    fixtures: generateFixtures(world.leagues[newLeagueId].clubIds, world.seed, newNumber),
    currentMatchday: 1,
    totalMatchdays: totalMatchdaysFor(world, newLeagueId),
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
