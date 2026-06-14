import { overall } from './attrs';
import { ageGrowthMod, PROGRESSION, SIM, TRAINING } from './config';
import type { Area } from './attrs';
import type { Player, PlayerRating, Position } from './types';
import { clamp } from './util';

function signatureKey(pos: Position): Area {
  switch (pos) {
    case 'GK':
    case 'DEF':
      return 'defending';
    case 'MID':
      return 'midfield';
    case 'FWD':
      return 'attacking';
  }
}

function bump(player: Player, key: Area, delta: number): void {
  const cur = player.attrs[key] ?? 50;
  player.attrs[key] = Math.round(clamp(cur + delta, 1, 99));
}

/**
 * Apply one match's outcome to a player who PLAYED: updates season counters,
 * form (EMA of recent performance), and slowly nudges ability toward potential.
 * Bench players are simply never passed here, so rotation has a real cost.
 * Mutates the player (it is mutable game state owned by the save).
 *
 * When `inTraining` is set, development is biased in the player's favour: good
 * matches grow ability much faster, while poor matches cost far less than usual.
 */
export function applyMatchProgression(player: Player, r: PlayerRating, inTraining = false): void {
  player.seasonApps += 1;
  player.seasonGoals += r.goals;
  player.seasonAssists += r.assists;
  // career totals accumulate across seasons (default for pre-career saves)
  player.careerGoals = (player.careerGoals ?? 0) + r.goals;
  player.careerAssists = (player.careerAssists ?? 0) + r.assists;

  // form: EMA of (rating - base), clamped to [-5, +5]; affects only the next match
  player.form = clamp(
    (1 - PROGRESSION.FORM_ALPHA) * player.form + PROGRESSION.FORM_ALPHA * (r.rating - SIM.RATING_BASE),
    PROGRESSION.FORM_MIN,
    PROGRESSION.FORM_MAX,
  );

  // growth: small, potential- and age-capped, accumulated as fractional XP
  const headroom = Math.max(0, player.potential - overall(player));
  const perf = clamp(r.rating - PROGRESSION.PERF_PIVOT, -PROGRESSION.PERF_CLAMP, PROGRESSION.PERF_CLAMP);
  let growth =
    perf * PROGRESSION.GROWTH_RATE * ageGrowthMod(player.age) * (headroom / PROGRESSION.HEADROOM_DIV);
  if (inTraining) {
    growth *= growth >= 0 ? TRAINING.GROWTH_MULT : TRAINING.DECLINE_MULT;
  }
  player.growthXp += growth;

  const key = signatureKey(player.position);
  while (player.growthXp >= PROGRESSION.XP_THRESHOLD) {
    bump(player, key, +1);
    player.growthXp -= PROGRESSION.XP_THRESHOLD;
  }
  while (player.growthXp <= -PROGRESSION.XP_THRESHOLD) {
    bump(player, key, -1);
    player.growthXp += PROGRESSION.XP_THRESHOLD;
  }
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
    bump(player, signatureKey(player.position), -drop);
  }
}
