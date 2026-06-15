import type { Formation, Position } from './types';

/**
 * All tunable constants live here so balance can be adjusted without touching
 * algorithm code, and tests can probe edge behaviour by overriding them.
 */

// Bumped to 3 for the fully-simulated world: every league is now played
// match-by-match, so the season carries `otherFixtures`. Older saves (no
// `otherFixtures`) fail validation in the store and fall back to "no save".
export const SAVE_VERSION = 3;

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
  // ---- discipline (cards) ----
  CARD_LAMBDA: 1.7, // mean bookable incidents per team per match (~3.4 cards/match)
  STRAIGHT_RED_SHARE: 0.018, // share of incidents that are a straight red
  // chance a booked player's next bookable offence is actually a second yellow
  // (most are waved away) — keeps two-yellow dismissals realistically rare.
  SECOND_YELLOW_SHARE: 0.2,
  RED_SUSPENSION: 1, // matchdays a sent-off (red-carded) player misses
  // in-match cost of playing a man down (a sending-off, or an injury once subs are
  // used up): a team is weakened across attack, midfield and defence in proportion
  // to how long it plays short — so it also lifts the opponent's scoring. (down at
  // 70' ≈ -8% all over; down at 20' ≈ -27%.)
  RED_STRENGTH_PENALTY: 0.35,
  // a sent-off player's match rating is docked this much (clamped >= 1), which in
  // turn nudges his development down through the usual rating -> growth path.
  RED_CARD_RATING_PENALTY: 3,
  // relative likelihood of being booked, by position (defenders/midfielders foul more)
  cardPropensity: { GK: 0.25, DEF: 1.15, MID: 1.2, FWD: 0.85 } as Record<Position, number>,
} as const;

// ---- substitutions ----
// Teams make automatic in-match subs: forced ones for injuries, then tactical
// ones up to a realistic target (top leagues average ~4 of a possible 5 per team).
export const SUBS = {
  MAX: 5, // IFAB cap; an injury after this leaves the team a man down
  // target TOTAL subs per team, drawn from a uniform via these thresholds -> 2,3,4,5
  // (weights 0.10/0.20/0.32/0.38 => mean ≈ 3.98 per team)
  TARGET_THRESHOLDS: [0.1, 0.3, 0.62] as readonly number[],
  MIN_MINUTE: 55, // tactical subs land in the closing stretch
  MAX_MINUTE: 85,
} as const;

// ---- injuries ----
// Match injuries are rare per game but force squad rotation: an injured player is
// unavailable for `matchesOut` matchdays and recovers one matchday at a time.
export const INJURY = {
  LAMBDA: 0.18, // mean injuries per team per match (~1 every few matches for a club)
  // severity bands -> matchdays out, chosen by weight (weights sum to 1)
  BANDS: [
    { weight: 0.6, min: 1, max: 2 }, // a knock
    { weight: 0.3, min: 3, max: 5 }, // a few weeks out
    { weight: 0.1, min: 6, max: 10 }, // a serious lay-off
  ] as readonly { weight: number; min: number; max: number }[],
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
  DECLINE_AGE: 31,
  RETIRE_AGE: 39,
} as const;

// ---- form / momentum ----
// A player's `form` (added to his area ratings for the NEXT match, and a pull on
// his development) is rebuilt each appearance from match momentum: it decays
// toward 0, then swings on the result — scaled by the Elo surprise, so beating a
// favourite (or even drawing one) lifts form far more than seeing off a minnow,
// and losing to a giant barely dents it. Goals/assists/clean sheets add on top
// (opponent-scaled); cards subtract; returning from injury costs "ring rust".
export const FORM = {
  MIN: -5,
  MAX: 5,
  DECAY: 0.18, // form *= (1 - DECAY) each appearance before the match's effects
  RESULT: 1.8, // result swing = RESULT * (score - oppExpected); score ∈ {1, .5, 0}
  GOAL: 0.6, // per goal, × opponent multiplier
  ASSIST: 0.35, // per assist, × opponent multiplier
  CLEAN_SHEET: 0.5, // GK/DEF only, × opponent multiplier
  YELLOW: 0.3, // per yellow, ÷ opponent multiplier (softened vs stronger sides)
  RED: 0.9, // per red, ÷ opponent multiplier
  INJURY_PER_MATCH: 0.18, // ring-rust per matchday of lay-off, applied at onset
  INJURY_MAX: 2.5, // cap on the injury hit
  INJURY_RANDOM_FLOOR: 0, // hit ×= FLOOR + (1-FLOOR)*rng() — low rolls "came back fine"
  GROWTH_FORM_COEFF: 0.1, // form's pull on development (±0.5 on the perf term at form ±5)
  // Consecutive-appearance streaks amplify a repeated form event (goal/assist/
  // clean sheet, and — negatively — bookings). The Nth in a row scales the swing
  // by 1 + STREAK_STEP * min(level-1, STREAK_MAX_STEPS): L1 ×1, L2 ×1.5, L3 ×2.
  STREAK_STEP: 0.5,
  STREAK_MAX_STEPS: 2, // level caps at STREAK_MAX_STEPS + 1 = 3 (×2)
  // A team on a winning run shrugs off a bad result: the NEGATIVE result swing
  // (loss, or a draw when favoured) is multiplied by a cushion based on the run
  // it carried INTO the match. Wins/upset draws are never dampened.
  RESULT_CUSHION_WIN1: 0.75, // won ≥1 of the last 2 → −25%
  RESULT_CUSHION_WIN2: 0.625, // won the last 2 in a row → −37.5%
  RESULT_CUSHION_WIN3: 0.5, // won the last 3 in a row → −50%
  RECENT_FORM_KEEP: 5, // matches of W/D/L history retained per club
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
  // Strength-bar display range. Reputation seeds land in 1380..1880; pad to
  // 1200..2000 so the weakest clubs still show a partial bar and dominant
  // clubs have room to fill it (values outside the range clamp to 0/1).
  DISPLAY_MIN: 1200,
  DISPLAY_MAX: 2000,
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
