import type { Formation, Position } from './types';

/**
 * All tunable constants live here so balance can be adjusted without touching
 * algorithm code, and tests can probe edge behaviour by overriding them.
 */

// Bumped to 2 for the country/division-pyramid world: older saves (flat leagues,
// no `countries`/tier) fail validation in the store and fall back to "no save".
export const SAVE_VERSION = 2;

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
  wAtk: { GK: 0, DEF: 0.15, MID: 0.55, FWD: 1 } as Record<Position, number>,
  wDef: { GK: 0, DEF: 1, MID: 0.45, FWD: 0.1 } as Record<Position, number>,
  wMid: { GK: 0, DEF: 0.3, MID: 1, FWD: 0.4 } as Record<Position, number>,
  GK_DEF_BLEND: 0.25, // team DEF = (1-b)*outfieldDef + b*keeper.defending
  // who scores: weight = attacking^EXP * posScoreMult
  SCORER_ATK_EXP: 1.5,
  posScoreMult: { GK: 0, DEF: 0.08, MID: 0.45, FWD: 1 } as Record<Position, number>,
  // per-player rating
  RATING_BASE: 6,
  GOAL_PTS: 1.1,
  ASSIST_PTS: 0.7,
  RESULT_ADJ: 0.4, // ± for win/loss
  CLEAN_SHEET_ADJ: 0.6, // GK/DEF bonus
  CONCEDE_PEN: 0.15, // GK/DEF per-goal-conceded penalty
  RATING_JITTER: 0.6, // ± seeded jitter span
} as const;

// ---- content generation ----
export const CONTENT = {
  GENERATOR_VERSION: 2,
  // The world is a set of countries, each with a stacked division pyramid.
  COUNTRY_COUNT: 4,
  TIERS_PER_COUNTRY: 3, // each country runs 3 leagues (top → bottom)
  LEAGUES: 12, // MUST equal COUNTRY_COUNT * TIERS_PER_COUNTRY
  CLUBS_PER_LEAGUE: 16, // even -> clean double round-robin (30 matchdays)
  SQUAD_SIZE: 22,
  POSITION_QUOTA: { GK: 3, DEF: 8, MID: 6, FWD: 5 } as Record<Position, number>,
  // Reputation mean per tier (top first). Higher tiers field stronger squads and
  // richer clubs, so promotion is a real step up and relegation a step down.
  // Indexed by `tier - 1`; tiers beyond the list reuse the last (weakest) mean.
  TIER_REP_MEAN: [73, 60, 48] as readonly number[],
  REP_SD: 8,
  REP_MIN: 38,
  REP_MAX: 88,
  STAT_NOISE_SD: 4,
  NEW_CLUB_REPUTATION: 55, // a user-created club starts as a mid-table newcomer
} as const;

// ---- league pyramid (promotion / relegation) ----
export const PYRAMID = {
  // Clubs that swap between two adjacent tiers each season: the bottom
  // PROMOTION_SLOTS of the upper league go down, the top PROMOTION_SLOTS of the
  // lower league come up. Must be < CLUBS_PER_LEAGUE / 2 so the up/down bands
  // never overlap within a league.
  PROMOTION_SLOTS: 3,
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
  GK: { attacking: 0, defending: 0.9, midfield: 0.1 },
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
  XP_THRESHOLD: 1,
  EVENT_MULT: 3, // growth ×3 per match achievement — a goal/assist, or a clean sheet for GK/DEF; they stack
  CONTRIB_DECLINE_MULT: 0.3, // a scorer/assister loses far less ability after a poor game
  FORM_ALPHA: 0.45, // EMA weight on the latest rating
  FORM_MIN: -5,
  FORM_MAX: 5,
  DECLINE_AGE: 31,
  RETIRE_AGE: 39,
} as const;

// ---- training ----
// Players placed in the manager's training slots develop faster after matches:
// good performances grow them much harder, while poor ones cost them far less.
export const TRAINING = {
  SLOTS: 3,
  GROWTH_MULT: 5, // positive growth after a good match ×5
  DECLINE_MULT: 0.3, // negative growth after a bad match softened (they lose less)
  PASSIVE_RATE: 0.15, // off-pitch growth each matchday for a training player who didn't play
} as const;

// age modifier for growth speed
export function ageGrowthMod(age: number): number {
  if (age <= 21) return 1.4;
  if (age <= 25) return 1;
  if (age <= 29) return 0.5;
  if (age <= 32) return 0.15;
  return 0;
}

// ---- transfer market ----
export const MARKET = {
  MIN_SQUAD: 18, // a club won't sell below this many players
  MAX_SQUAD: 25, // a club won't buy above this (gen size is 22, leaving slack)
  SELL_RETURN: 0.9, // fraction of value the seller receives on a sale
  // valuation: value(overall, age) scaled to a plausible fee range (thousands)
  VAL_SCALE: 90000, // a 99-overall peak-age player ≈ €90M
  VAL_EXP: 2.5, // convexity: stars cost disproportionately more
  VAL_FLOOR_OVR: 35, // overalls at/below this carry ~no fee
  POT_PREMIUM: 0.6, // weight of (potential - overall) headroom on value
  // budgets seeded from reputation (thousands)
  BUDGET_SCALE: 250000, // a max-reputation club starts ≈ €250M
  BUDGET_FLOOR: 5000, // every club has at least €5M
  // base match income earned by each club per result (thousands). A win is the
  // even-match baseline and is scaled by the opponent's ranking (see RANKING);
  // a draw and a loss are flat. Kept below the scaled win floor (250) so a win
  // never pays less than a draw.
  MATCH_INCOME: { WIN: 500, DRAW: 200, LOSS: 100 }, // €0.5M (even win) / €0.2M / €0.1M
  // end-of-season prize for clubs in the played league, scaled by final position
  SEASON_PRIZE_BASE: 4000, // last place ≈ €4M
  SEASON_PRIZE_PER_PLACE: 3000, // + €3M per place above last
  SEASON_PRIZE_CHAMPION: 8000, // extra bonus for finishing 1st
  // flat income for clubs in non-played leagues, to keep the wider market liquid
  SEASON_INCOME_BASE: 8000, // €8M flat
  SEASON_INCOME_REP: 1200, // + €1.2M per reputation point above the floor
} as const;

// ---- team ranking (Elo) ----
// Every club carries an Elo-style ranking that rises on wins and falls on losses
// by an amount set by the opponent's strength. It seeds from reputation, updates
// after every match (zero-sum, so the world average stays stable), gets a nudge
// from each season's final league position, and scales the win match income.
export const RANKING = {
  // initial ranking = REP_RATING_BASE + reputation * REP_RATING_SLOPE
  // (rep 38 -> 1380, rep 73 -> 1730, rep 88 -> 1880).
  REP_RATING_BASE: 1000,
  REP_RATING_SLOPE: 10,
  ELO_K: 24, // per-match volatility ("a little bit" each game)
  ELO_SCALE: 400, // standard Elo logistic denominator
  POSITION_SWING: 40, // ± ranking at the top/bottom of the table each season end
  // win income multiplier = clamp(2 - 2*expectedScore, MIN, MAX): even match -> 1,
  // beating a stronger side -> up to 2, beating a weaker side -> down to 0.5.
  REWARD_MULT_MIN: 0.5,
  REWARD_MULT_MAX: 2,
} as const;

export const FORMATIONS: Record<Formation, Record<Position, number>> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
};

export const DEFAULT_FORMATION: Formation = '4-4-2';
