import type { Formation, Position } from './types';

/**
 * All tunable constants live here so balance can be adjusted without touching
 * algorithm code, and tests can probe edge behaviour by overriding them.
 */

export const SAVE_VERSION = 1;

// ---- match simulation ----
export const SIM = {
  BASE_CHANCES: 11, // league-average chances per team at parity
  MID_TEMP: 12, // logistic temperature for the midfield -> possession map
  BASE_CONV: 0.11, // base chance-conversion probability
  CONV_EXP: 0.7, // compresses extreme attack/defence mismatches
  CONV_MIN: 0.02,
  CONV_MAX: 0.45,
  P_PEN: 0.78, // penalty conversion
  PEN_RATE: 0.013, // share of chances that are penalties (~0.13 pens/team/match)
  P_FK_BASE: 0.1, // free-kick conversion scaler (x taker.attacking/100)
  FK_RATE: 0.02, // share of chances that are direct free kicks
  P_ASSIST: 0.74, // probability an open-play goal has an assist
  HEADER_SHARE: 0.25, // share of open-play goals flagged as headers
  HOME_ATK_MULT: 1.08,
  HOME_DEF_MULT: 1.04,
  CAPTAIN_MORALE_MAX: 0.03, // ±3% team strength at captain stat extremes
  // per-area position weights (weighted means keep ratings on a ~1..99 scale)
  wAtk: { GK: 0, DEF: 0.15, MID: 0.55, FWD: 1.0 } as Record<Position, number>,
  wDef: { GK: 0, DEF: 1.0, MID: 0.45, FWD: 0.1 } as Record<Position, number>,
  wMid: { GK: 0, DEF: 0.3, MID: 1.0, FWD: 0.4 } as Record<Position, number>,
  GK_DEF_BLEND: 0.25, // team DEF = (1-b)*outfieldDef + b*keeper.defending
  // who scores: weight = attacking^EXP * posScoreMult
  SCORER_ATK_EXP: 1.5,
  posScoreMult: { GK: 0, DEF: 0.08, MID: 0.45, FWD: 1.0 } as Record<Position, number>,
  // per-player rating
  RATING_BASE: 6.0,
  GOAL_PTS: 1.1,
  ASSIST_PTS: 0.7,
  RESULT_ADJ: 0.4, // ± for win/loss
  CLEAN_SHEET_ADJ: 0.6, // GK/DEF bonus
  CONCEDE_PEN: 0.15, // GK/DEF per-goal-conceded penalty
  RATING_JITTER: 0.6, // ± seeded jitter span
} as const;

// ---- content generation ----
export const CONTENT = {
  GENERATOR_VERSION: 1,
  LEAGUES: 6,
  CLUBS_PER_LEAGUE: 16, // even -> clean double round-robin (30 matchdays)
  SQUAD_SIZE: 22,
  POSITION_QUOTA: { GK: 3, DEF: 8, MID: 6, FWD: 5 } as Record<Position, number>,
  REP_MEAN: 65,
  REP_SD: 11,
  REP_MIN: 45,
  REP_MAX: 85,
  STAT_NOISE_SD: 4,
  NEW_CLUB_REPUTATION: 55, // a user-created club starts as a mid-table newcomer
} as const;

// signature stat offsets from a player's base overall, per position
export const POSITION_FACETS: Record<Position, { attacking: number; defending: number; midfield: number }> = {
  GK: { attacking: -28, defending: 6, midfield: -18 },
  DEF: { attacking: -12, defending: 8, midfield: -3 },
  MID: { attacking: -2, defending: -4, midfield: 6 },
  FWD: { attacking: 8, defending: -14, midfield: -4 },
};

// weights used to compute a single "overall" from the coarse trio, per position
export const OVERALL_WEIGHTS: Record<Position, { attacking: number; defending: number; midfield: number }> = {
  GK: { attacking: 0.0, defending: 0.9, midfield: 0.1 },
  DEF: { attacking: 0.1, defending: 0.6, midfield: 0.3 },
  MID: { attacking: 0.25, defending: 0.15, midfield: 0.6 },
  FWD: { attacking: 0.7, defending: 0.1, midfield: 0.2 },
};

// ---- progression ----
export const PROGRESSION = {
  GROWTH_RATE: 0.08,
  PERF_PIVOT: 6.5, // ratings above this grow a player, below shrink
  PERF_CLAMP: 1.5,
  HEADROOM_DIV: 25,
  XP_THRESHOLD: 1.0,
  FORM_ALPHA: 0.45, // EMA weight on the latest rating
  FORM_MIN: -5,
  FORM_MAX: 5,
  DECLINE_AGE: 31,
  RETIRE_AGE: 39,
} as const;

// age modifier for growth speed
export function ageGrowthMod(age: number): number {
  if (age <= 21) return 1.4;
  if (age <= 25) return 1.0;
  if (age <= 29) return 0.5;
  if (age <= 32) return 0.15;
  return 0;
}

export const FORMATIONS: Record<Formation, Record<Position, number>> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
};

export const DEFAULT_FORMATION: Formation = '4-4-2';
