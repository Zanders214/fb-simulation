import { overall } from './attrs';
import { ageGrowthMod, PROGRESSION, SIM, TRAINING } from './config';
import type { Area } from './attrs';
import type { Player, PlayerRating } from './types';
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
  player.seasonApps += 1;
  player.seasonGoals += r.goals;
  player.seasonAssists += r.assists;
  // career totals accumulate across seasons (default for pre-career saves)
  player.careerGoals = (player.careerGoals ?? 0) + r.goals;
  player.careerAssists = (player.careerAssists ?? 0) + r.assists;
  player.careerApps = (player.careerApps ?? 0) + 1;

  // form: EMA of (rating - base), clamped to [-5, +5]; affects only the next match
  player.form = clamp(
    (1 - PROGRESSION.FORM_ALPHA) * player.form + PROGRESSION.FORM_ALPHA * (r.rating - SIM.RATING_BASE),
    PROGRESSION.FORM_MIN,
    PROGRESSION.FORM_MAX,
  );

  // growth: small, potential- and age-capped, accumulated as fractional XP
  const headroom = Math.max(0, player.potential - overall(player));
  const perf = clamp(r.rating - PROGRESSION.PERF_PIVOT, -PROGRESSION.PERF_CLAMP, PROGRESSION.PERF_CLAMP);
  const growth =
    perf * PROGRESSION.GROWTH_RATE * ageGrowthMod(player.age) * (headroom / PROGRESSION.HEADROOM_DIV);

  const contributed = r.goals > 0 || r.assists > 0;
  const keptCleanSheet = Boolean(ctx.cleanSheet) && (player.position === 'GK' || player.position === 'DEF');
  player.growthXp += scaleGrowth(growth, contributed, keptCleanSheet, Boolean(ctx.inTraining));
  applyGrowthXp(player);
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
  player.seasonCleanSheets = 0;
  player.form = 0;

  if (player.age >= PROGRESSION.DECLINE_AGE) {
    const drop = player.age >= 34 ? 2 : 1;
    bump(player, -drop);
  }
}
