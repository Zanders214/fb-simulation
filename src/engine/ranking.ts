/**
 * Team ranking: an Elo-style strength rating every club carries. It seeds from
 * reputation, moves after each match by an amount set by the opponent's rating
 * (beat a favourite → big gain; lose to a minnow → big drop), gets nudged by the
 * final league position each season, and scales the win match income.
 *
 * Pure and deterministic like the rest of the engine — these functions either
 * read the world or mutate club rankings in place, and never touch React/storage.
 */
import { RANKING } from './config';
import type { ClubId, MatchResult, World } from './types';
import { clamp } from './util';

/** Starting ranking for a club, derived linearly from its reputation (1..100). */
export function initialRanking(reputation: number): number {
  return RANKING.REP_RATING_BASE + reputation * RANKING.REP_RATING_SLOPE;
}

/**
 * Read a club's ranking, falling back to a reputation-derived value for clubs
 * saved before rankings existed (so no save migration is required). The first
 * match or season rollover then writes a real value back.
 */
export function clubRanking(world: World, clubId: ClubId): number {
  const club = world.clubs[clubId];
  return club.ranking ?? initialRanking(club.reputation);
}

/**
 * Map a ranking to a 0..1 fill fraction for strength bars. Linear across the
 * padded display range (see RANKING.DISPLAY_*), clamped so out-of-range values
 * read as empty/full rather than overflowing the bar.
 */
export function rankingFraction(ranking: number): number {
  return clamp((ranking - RANKING.DISPLAY_MIN) / (RANKING.DISPLAY_MAX - RANKING.DISPLAY_MIN), 0, 1);
}

/** Elo expected score (win probability) of a team rated `myRating` vs `oppRating`. */
export function expectedScore(myRating: number, oppRating: number): number {
  return 1 / (1 + 10 ** ((oppRating - myRating) / RANKING.ELO_SCALE));
}

/** Actual score of a result for goal totals `my` vs `opp`: 1 win / 0.5 draw / 0 loss. */
function scoreFor(my: number, opp: number): number {
  if (my > opp) return 1;
  if (my < opp) return 0;
  return 0.5;
}

/**
 * Update both clubs' rankings from a finished match, in place. Zero-sum: the
 * winner gains exactly what the loser drops (a draw nets each toward the other),
 * so the world's average ranking never drifts. Deterministic — no RNG.
 */
export function applyMatchRanking(world: World, result: MatchResult): void {
  const { homeClubId, awayClubId, homeGoals, awayGoals } = result;
  const homeR = clubRanking(world, homeClubId);
  const awayR = clubRanking(world, awayClubId);
  const homeDelta = RANKING.ELO_K * (scoreFor(homeGoals, awayGoals) - expectedScore(homeR, awayR));
  world.clubs[homeClubId].ranking = homeR + homeDelta;
  world.clubs[awayClubId].ranking = awayR - homeDelta;
}

/**
 * Win-income multiplier for beating an opponent, by the ranking gap: 1 at parity,
 * up to REWARD_MULT_MAX against a much stronger side, down to REWARD_MULT_MIN
 * against a much weaker one.
 */
export function rankingRewardMultiplier(myRating: number, oppRating: number): number {
  return clamp(2 - 2 * expectedScore(myRating, oppRating), RANKING.REWARD_MULT_MIN, RANKING.REWARD_MULT_MAX);
}

/**
 * Season-end ranking nudge for finishing `position` (1-based) of `size`: linear
 * from +POSITION_SWING for the champion to −POSITION_SWING for last, 0 mid-table.
 * Symmetric, so it sums to ~0 across a full league.
 */
export function rankingPositionDelta(position: number, size: number): number {
  if (size <= 1) return 0;
  return (RANKING.POSITION_SWING * (size + 1 - 2 * position)) / (size - 1);
}
