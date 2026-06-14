import { overall } from './attrs';
import { MARKET, SAVE_VERSION } from './config';
import { generateFixtures } from './fixtures';
import {
  applyCard,
  applyInjury,
  applyMatchProgression,
  applySeasonEnd,
  applyTrainingProgression,
} from './progression';
import { applyPromotionRelegation, projectLeagueOrder } from './promotion';
import { applyMatchRanking, clubRanking, rankingPositionDelta } from './ranking';
import { hashSeed, makeRng } from './rng';
import { type SimTeam, simulateMatch } from './sim';
import { computeTable } from './standings';
import type {
  ClubId,
  Fixture,
  GameState,
  LeagueId,
  MatchResult,
  Movement,
  Player,
  PlayerId,
  Position,
  Season,
  SquadConfig,
  TableRow,
  World,
} from './types';
import { clubBudget, clubSquadValue, matchIncome, type MatchOutcome, playerValue, seasonPrize } from './transfers';
import { autoPickSquad, isAvailable } from './world';

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

/**
 * Best available reserve for a slot: the highest-overall fit player of `position`
 * if there is one, otherwise the highest-overall fit player of any position.
 * `taken` holds everyone already in the XI so no one is fielded twice.
 */
function bestFitReserve(world: World, clubId: ClubId, position: Position, taken: Set<string>): Player | undefined {
  const candidates = world.clubs[clubId].playerIds
    .map((id) => world.players[id])
    .filter((p): p is Player => Boolean(p) && isAvailable(p) && !taken.has(p.id))
    .sort((a, b) => overall(b) - overall(a));
  if (!candidates.length) return undefined;
  return candidates.find((p) => p.position === position) ?? candidates[0];
}

/**
 * Build the user's XI from their saved lineup, replacing each injured/suspended
 * starter — in their own slot — with the best available reserve of the SAME
 * position (falling back to the best available reserve of any position only when
 * no fit same-position player is left). Reserves are never fielded twice. The XI
 * can only drop below 11 if the entire squad has fewer than 11 fit players, which
 * the squad-size rules (min 18) make effectively impossible — so the team never
 * lines up a man short just because a starter is unavailable.
 */
function fieldUserXI(world: World, clubId: ClubId, squad: SquadConfig): Player[] {
  const taken = new Set<string>();
  // reserve the fit starters' own slots first so they can't be used as cover
  for (const id of squad.startingXI) {
    const p = world.players[id];
    if (p && isAvailable(p)) taken.add(id);
  }

  const xi: Player[] = [];
  for (const id of squad.startingXI) {
    const starter = world.players[id];
    if (starter && isAvailable(starter)) {
      xi.push(starter);
      continue;
    }
    const replacement = bestFitReserve(world, clubId, starter?.position ?? 'MID', taken);
    if (replacement) {
      taken.add(replacement.id);
      xi.push(replacement);
    }
  }
  return xi;
}

/** Fit players from a list of ids that aren't already in the starting XI — the in-match sub pool. */
function benchFrom(world: World, ids: PlayerId[], inXI: Set<string>): Player[] {
  return ids
    .map((id) => world.players[id])
    .filter((p): p is Player => Boolean(p) && isAvailable(p) && !inXI.has(p.id));
}

function simTeamFor(
  world: World,
  clubId: ClubId,
  managedClubId: ClubId,
  managedSquad: SquadConfig,
  homeAdvantage: boolean,
): SimTeam {
  // AI squads are auto-picked from fit players already; the user's fixed XI may
  // include an injured/suspended starter, so swap in a same-position replacement.
  if (clubId !== managedClubId) {
    const squad = autoPickSquad(world, clubId);
    const players = squad.startingXI.map((id) => world.players[id]).filter(Boolean);
    const bench = benchFrom(world, squad.bench, new Set(squad.startingXI));
    return { clubId, players, bench, roles: squad.roles, homeAdvantage };
  }
  const players = fieldUserXI(world, clubId, managedSquad);
  const bench = benchFrom(world, managedSquad.bench ?? [], new Set(players.map((p) => p.id)));
  return { clubId, players, bench, roles: managedSquad.roles, homeAdvantage };
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

/**
 * Credit each club its match income (a win scaled by the opponent's ranking), in
 * place. Must run before `applyMatchRanking` so the scaling uses pre-match ratings.
 */
function awardMatchIncome(world: World, result: MatchResult): void {
  const { homeClubId, awayClubId, homeGoals, awayGoals } = result;
  const homeR = clubRanking(world, homeClubId);
  const awayR = clubRanking(world, awayClubId);
  world.clubs[homeClubId].budget = clubBudget(world, homeClubId) + matchIncome(outcomeFor(homeGoals, awayGoals), homeR, awayR);
  world.clubs[awayClubId].budget = clubBudget(world, awayClubId) + matchIncome(outcomeFor(awayGoals, homeGoals), awayR, homeR);
}

/** Match income the managed club earns from one of its own results, in thousands. */
function userMatchEarnings(world: World, managedClubId: ClubId, result: MatchResult): number {
  const isHome = result.homeClubId === managedClubId;
  const oppClubId = isHome ? result.awayClubId : result.homeClubId;
  const my = isHome ? result.homeGoals : result.awayGoals;
  const opp = isHome ? result.awayGoals : result.homeGoals;
  return matchIncome(outcomeFor(my, opp), clubRanking(world, managedClubId), clubRanking(world, oppClubId));
}

/**
 * Apply post-match development to everyone who featured for one team — the
 * starting XI (credited as a start) and any players brought on (credited as a
 * substitute appearance) — tracking who featured so benched players don't also
 * collect off-pitch training growth.
 */
function applyTeamProgression(
  state: GameState,
  team: SimTeam,
  conceded: number,
  training: Set<string>,
  played: Set<string>,
  result: MatchResult,
): void {
  const cleanSheet = conceded === 0;
  const develop = (id: PlayerId, appearance: 'start' | 'sub') => {
    const r = result.ratings[id];
    const player = state.world.players[id];
    if (!r || !player) return;
    applyMatchProgression(player, r, { inTraining: training.has(id), cleanSheet, appearance });
    played.add(id);
    recordPlayerMatchStats(state, player, r, cleanSheet);
  };
  for (const p of team.players) develop(p.id, 'start');
  for (const s of result.subs) if (s.clubId === team.clubId) develop(s.onPlayerId, 'sub');
}

/**
 * Record a played match's lasting stats for one player: clean sheets (keepers &
 * defenders, season + career), the club's all-time goal/assist ledger — kept on
 * the player's current club and keyed by player id, so a sold player's tally
 * survives his departure — and the player's peak market value. Mutates the
 * player and his club. Season/career counters that the sim already owns are set
 * elsewhere.
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
  if (r.goals > 0 || r.assists > 0) {
    const club = state.world.clubs[player.clubId];
    club.playerContributions ??= {};
    const entry = club.playerContributions[player.id] ?? { goals: 0, assists: 0 };
    entry.goals += r.goals;
    entry.assists += r.assists;
    club.playerContributions[player.id] = entry;
  }
  player.peakValue = Math.max(player.peakValue ?? 0, playerValue(player));
}

/**
 * Add a card to a club's all-time per-player ledger (the same one that tracks
 * goals/assists), keyed by the club the player turned out for. Survives a later
 * transfer, like the goal/assist ledger. Mutates the club.
 */
function recordClubCard(world: World, card: MatchResult['cards'][number]): void {
  const club = world.clubs[card.clubId];
  if (!club) return;
  club.playerContributions ??= {};
  const entry = club.playerContributions[card.playerId] ?? { goals: 0, assists: 0 };
  if (card.type === 'yellow') entry.yellow = (entry.yellow ?? 0) + 1;
  else entry.red = (entry.red ?? 0) + 1;
  club.playerContributions[card.playerId] = entry;
}

/**
 * Apply a match's cards and injuries to player state: tally bookings, suspend
 * sent-off players, sideline the injured, and log cards to the club's all-time
 * ledger. Records everyone newly ruled out so the matchday's recovery tick
 * doesn't immediately count down a fresh absence.
 */
function applyMatchDiscipline(world: World, result: MatchResult, newlyOut: Set<string>): void {
  for (const card of result.cards ?? []) {
    const player = world.players[card.playerId];
    if (!player) continue;
    applyCard(player, card);
    recordClubCard(world, card);
    if (card.type === 'red') newlyOut.add(player.id);
  }
  for (const injury of result.injuries ?? []) {
    const player = world.players[injury.playerId];
    if (!player) continue;
    applyInjury(player, injury);
    newlyOut.add(player.id);
  }
}

/**
 * Heal one matchday off every active injury/suspension, skipping anyone who was
 * just ruled out this matchday (so a knock picked up today isn't already a day
 * shorter). Runs once per matchday over the whole world — only sidelined players
 * are touched — so absences tick down wherever the player now is.
 */
function recoverAbsences(world: World, newlyOut: Set<string>): void {
  for (const id of Object.keys(world.players)) {
    if (newlyOut.has(id)) continue;
    const player = world.players[id];
    if ((player.injuredMatches ?? 0) > 0) player.injuredMatches = (player.injuredMatches ?? 0) - 1;
    if ((player.suspendedMatches ?? 0) > 0) player.suspendedMatches = (player.suspendedMatches ?? 0) - 1;
  }
}

/**
 * Simulate every fixture of the current matchday (including the user's),
 * applying per-player progression to everyone who played, recording cards and
 * injuries, healing existing absences, and advancing the matchday counter.
 * Mutates `state` in place (and returns the outcome).
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
  const newlyOut = new Set<string>(); // injured/sent off this matchday
  const fixtures = season.fixtures.filter((f) => f.matchday === md);
  fixtures.forEach((f, i) => {
    const rng = makeRng(hashSeed(world.seed, season.number, md, i));
    const home = simTeamFor(world, f.homeClubId, state.managedClubId, state.squad, true);
    const away = simTeamFor(world, f.awayClubId, state.managedClubId, state.squad, false);
    const result = simulateMatch({ home, away, rng });
    f.result = result;
    results.push(result);
    // Income (and the user's reported earnings) read pre-match rankings; only then
    // does the Elo update move both clubs' rankings for the result just played.
    awardMatchIncome(world, result);
    if (f.homeClubId === state.managedClubId || f.awayClubId === state.managedClubId) {
      userResult = result;
      userEarnings = userMatchEarnings(world, state.managedClubId, result);
    }
    applyMatchRanking(world, result);
    applyTeamProgression(state, home, result.awayGoals, training, played, result);
    applyTeamProgression(state, away, result.homeGoals, training, played, result);
    applyMatchDiscipline(world, result, newlyOut);
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

  recoverAbsences(world, newlyOut);
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
 * Final finishing orders (best → worst) for *every* league in the world: the
 * real table for the league the user actually played, and a cheap seeded
 * projection for all other leagues (which are never simulated match-by-match).
 * Promotion (within the user's country) and the season-end ranking nudge both
 * read from this, so they always agree.
 */
function worldFinalOrders(state: GameState, playedOrder: ClubId[]): Record<LeagueId, ClubId[]> {
  const { world, season } = state;
  const orders: Record<LeagueId, ClubId[]> = {};
  for (const lid of Object.keys(world.leagues)) {
    if (lid === season.leagueId) {
      orders[lid] = playedOrder;
    } else {
      const rng = makeRng(hashSeed(world.seed, 9091, season.number, leagueSeedIndex(lid)));
      orders[lid] = projectLeagueOrder(world, lid, rng);
    }
  }
  return orders;
}

/** Nudge every club's ranking by where it finished its league this season. */
function applyRankingFinishes(world: World, finalOrders: Record<LeagueId, ClubId[]>): void {
  for (const order of Object.values(finalOrders)) {
    order.forEach((clubId, i) => {
      world.clubs[clubId].ranking = clubRanking(world, clubId) + rankingPositionDelta(i + 1, order.length);
    });
  }
}

/**
 * Run promotion/relegation across the user's country and move the live season to
 * follow the managed club into its new tier. Returns how the user's club moved.
 */
function applyUserCountryPyramid(state: GameState, finalOrders: Record<LeagueId, ClubId[]>): Movement {
  const { world, season } = state;
  const league = world.leagues[season.leagueId];
  const country = world.countries[league.countryId];
  if (!country) return 'stayed';

  const prevTier = league.tier;
  applyPromotionRelegation(world, country, finalOrders);

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

  // Nudge every club's ranking by its final league finish, then run promotion /
  // relegation (mutates leagues + the managed club's tier). Both read the same
  // world-wide finishing orders, so they always agree. Finally record the season
  // just played with the user's resulting movement.
  const finalOrders = worldFinalOrders(state, table.map((r) => r.clubId));
  applyRankingFinishes(world, finalOrders);
  const movement = applyUserCountryPyramid(state, finalOrders);
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
