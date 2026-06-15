import { overall } from './attrs';
import { ageGrowthMod, FORM, PROGRESSION, SIM, TRAINING } from './config';
import { rewardMultiplierFromExpected } from './ranking';
import type { Area } from './attrs';
import type { CardEvent, InjuryEvent, Player, PlayerRating } from './types';
import { clamp } from './util';

const AREAS: Area[] = ['attacking', 'defending', 'midfield'];

/**
 * Nudge a player's whole coarse profile by `delta`, clamped to [1, 99]. Moving
 * all three areas together raises (or lowers) overall ability while keeping the
 * player's identity intact — the gaps between, say, a forward's attacking and
 * defending are preserved, so a striker who develops gets better all round
 * without ever stopping being a striker. Used for both growth and decline.
 */
function bump(player: Player, delta: number): void {
  for (const area of AREAS) {
    const cur = player.attrs[area] ?? 50;
    player.attrs[area] = Math.round(clamp(cur + delta, 1, 99));
  }
}

/** Move accumulated fractional growth XP into whole ability points (both directions). */
function applyGrowthXp(player: Player): void {
  while (player.growthXp >= PROGRESSION.XP_THRESHOLD) {
    bump(player, +1);
    player.growthXp -= PROGRESSION.XP_THRESHOLD;
  }
  while (player.growthXp <= -PROGRESSION.XP_THRESHOLD) {
    bump(player, -1);
    player.growthXp += PROGRESSION.XP_THRESHOLD;
  }
}

/**
 * Scale raw match growth by contribution / clean-sheet / training modifiers.
 * Achievements accelerate gains and they stack; on a poor game they cushion the
 * loss instead. Training amplifies both directions.
 */
function scaleGrowth(growth: number, contributed: boolean, keptCleanSheet: boolean, inTraining: boolean): number {
  if (growth >= 0) {
    let eventMult = 0;
    if (contributed) eventMult += PROGRESSION.EVENT_MULT;
    if (keptCleanSheet) eventMult += PROGRESSION.EVENT_MULT;
    if (eventMult > 0) growth *= eventMult;
    if (inTraining) growth *= TRAINING.GROWTH_MULT;
    return growth;
  }
  if (contributed) growth *= PROGRESSION.CONTRIB_DECLINE_MULT;
  if (inTraining) growth *= TRAINING.DECLINE_MULT;
  return growth;
}

/**
 * What happened to the player's team in the match, used to bias development.
 */
export interface MatchContext {
  /** Player occupies one of the manager's training slots. */
  inTraining?: boolean;
  /** The player's team conceded no goals this match. */
  cleanSheet?: boolean;
  /** Whether the player started or came off the bench (default 'start'). */
  appearance?: 'start' | 'sub';
  /** Match result for the player's team: 1 win / 0.5 draw / 0 loss (drives form momentum). */
  score?: 0 | 0.5 | 1;
  /** Elo expected score of the player's team (0..1) — how big the opponent was. */
  oppExpected?: number;
}

/**
 * Apply one match's outcome to a player who PLAYED: updates season counters,
 * form (EMA of recent performance), and slowly nudges ability toward potential.
 * Bench players are simply never passed here, so rotation has a real cost.
 * Mutates the player (it is mutable game state owned by the save).
 *
 * Tangible contributions accelerate development: a goal or assist multiplies
 * growth by EVENT_MULT, and a clean sheet does the same for keepers/defenders;
 * the two stack (a defender who scores AND keeps a clean sheet gets EVENT_MULT
 * twice). When `inTraining` is set, growth is boosted further still. After a poor
 * game a contributor — or a training-slot player — loses far less than usual.
 */
export function applyMatchProgression(player: Player, r: PlayerRating, ctx: MatchContext = {}): void {
  if (ctx.appearance === 'sub') {
    player.seasonSubApps = (player.seasonSubApps ?? 0) + 1;
    player.careerSubApps = (player.careerSubApps ?? 0) + 1;
  } else {
    player.seasonApps += 1;
    player.careerApps = (player.careerApps ?? 0) + 1;
  }
  player.seasonGoals += r.goals;
  player.seasonAssists += r.assists;
  // career totals accumulate across seasons (default for pre-career saves)
  player.careerGoals = (player.careerGoals ?? 0) + r.goals;
  player.careerAssists = (player.careerAssists ?? 0) + r.assists;

  const formIn = player.form;
  const contributed = r.goals > 0 || r.assists > 0;
  const keptCleanSheet = Boolean(ctx.cleanSheet) && (player.position === 'GK' || player.position === 'DEF');

  // growth: small, potential- and age-capped, accumulated as fractional XP. Form
  // pulls development with it — a player in good form grows harder and declines
  // less for the same rating, and vice versa.
  const headroom = Math.max(0, player.potential - overall(player));
  const perf = clamp(
    r.rating - PROGRESSION.PERF_PIVOT + FORM.GROWTH_FORM_COEFF * formIn,
    -PROGRESSION.PERF_CLAMP,
    PROGRESSION.PERF_CLAMP,
  );
  const growth =
    perf * PROGRESSION.GROWTH_RATE * ageGrowthMod(player.age) * (headroom / PROGRESSION.HEADROOM_DIV);
  player.growthXp += scaleGrowth(growth, contributed, keptCleanSheet, Boolean(ctx.inTraining));
  applyGrowthXp(player);

  // form / momentum: decay toward 0, then swing on the result scaled by the Elo
  // surprise (an upset moves it far more than an expected outcome), plus
  // opponent-scaled bonuses for goals/assists/clean sheets. Clamped to [-5, +5];
  // affects only the next match (and, via the perf term above, development).
  const exp = ctx.oppExpected ?? 0.5;
  const oppMult = rewardMultiplierFromExpected(exp);
  let f = formIn * (1 - FORM.DECAY);
  if (ctx.score != null) f += FORM.RESULT * (ctx.score - exp);
  f += (FORM.GOAL * r.goals + FORM.ASSIST * r.assists) * oppMult;
  if (keptCleanSheet) f += FORM.CLEAN_SHEET * oppMult;
  player.form = clamp(f, FORM.MIN, FORM.MAX);
}

/**
 * Record a card shown to a player: bump the season + career tally, and put a
 * sent-off (red-carded) player out for the next matchday or two. Mutates the
 * player. Counters are read via `?? 0` so pre-update saves stay safe.
 */
export function applyCard(player: Player, card: CardEvent, oppMult = 1): void {
  // A booking dents form; the penalty is softened against a stronger opponent
  // (oppMult > 1) and sharper against a weaker one, the inverse of the bonuses.
  const penalty = (card.type === 'yellow' ? FORM.YELLOW : FORM.RED) / oppMult;
  player.form = clamp(player.form - penalty, FORM.MIN, FORM.MAX);
  if (card.type === 'yellow') {
    player.seasonYellowCards = (player.seasonYellowCards ?? 0) + 1;
    player.careerYellowCards = (player.careerYellowCards ?? 0) + 1;
    return;
  }
  player.seasonRedCards = (player.seasonRedCards ?? 0) + 1;
  player.careerRedCards = (player.careerRedCards ?? 0) + 1;
  player.suspendedMatches = Math.max(player.suspendedMatches ?? 0, SIM.RED_SUSPENSION);
}

/**
 * Record a match injury: sideline the player for the injury's duration, keeping
 * the worse of any overlapping knocks so a fresh light injury can't shorten a
 * serious one. Mutates the player.
 */
export function applyInjury(player: Player, injury: InjuryEvent, rng?: () => number): void {
  player.injuredMatches = Math.max(player.injuredMatches ?? 0, injury.matchesOut);
  // "Ring rust": a randomised form hit scaled by the lay-off length, applied now
  // (at onset) and left frozen while sidelined — a sidelined player never
  // re-enters match progression and recovery doesn't touch form, so it surfaces
  // on his first match back. A low random roll means he comes back unaffected.
  if (rng) {
    const base = Math.min(FORM.INJURY_MAX, FORM.INJURY_PER_MATCH * injury.matchesOut);
    const hit = base * (FORM.INJURY_RANDOM_FLOOR + (1 - FORM.INJURY_RANDOM_FLOOR) * rng());
    player.form = clamp(player.form - hit, FORM.MIN, FORM.MAX);
  }
}

/**
 * Off-pitch development for a training-slot player who did NOT play this
 * matchday: a steady, potential- and age-capped nudge toward potential, with no
 * match rating involved. Bench players normally never develop, so this is the
 * payoff for dedicating a training slot to someone who isn't in the XI. Purely
 * positive — the training ground never costs ability. Mutates the player.
 */
export function applyTrainingProgression(player: Player): void {
  const headroom = Math.max(0, player.potential - overall(player));
  const growth = TRAINING.PASSIVE_RATE * ageGrowthMod(player.age) * (headroom / PROGRESSION.HEADROOM_DIV);
  player.growthXp += growth;
  applyGrowthXp(player);
}

/**
 * End-of-season tick for EVERY player: age +1, reset season counters/form, and
 * apply a small decline to veterans.
 */
export function applySeasonEnd(player: Player): void {
  player.age += 1;
  player.seasonGoals = 0;
  player.seasonAssists = 0;
  player.seasonApps = 0;
  player.seasonSubApps = 0;
  player.seasonCleanSheets = 0;
  player.seasonYellowCards = 0;
  player.seasonRedCards = 0;
  player.form = 0;

  if (player.age >= PROGRESSION.DECLINE_AGE) {
    const drop = player.age >= 34 ? 2 : 1;
    bump(player, -drop);
  }
}
