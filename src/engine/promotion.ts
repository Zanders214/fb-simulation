/**
 * League pyramid: promotion & relegation between the stacked divisions of a
 * country. Pure and deterministic like the rest of the engine — every function
 * either reads the world or mutates it in place, and never touches React/storage.
 *
 * Only the user's own league is ever simulated match-by-match; the other tiers
 * in their country are resolved with a cheap, seeded projection of each club's
 * squad strength so the whole pyramid can shuffle realistically every season
 * without paying for full off-screen seasons.
 */
import { overall } from './attrs';
import { PYRAMID } from './config';
import type { ClubId, Country, LeagueId, Movement, World } from './types';
import { gaussian, type Rng } from './rng';

/** Spread of a projected season's noise, in overall points. */
const PROJECTION_NOISE_SD = 5;

/** Mean overall of a club's whole squad (0 for an empty squad). */
export function meanSquadOverall(world: World, clubId: ClubId): number {
  const ids = world.clubs[clubId]?.playerIds ?? [];
  if (!ids.length) return 0;
  let sum = 0;
  for (const id of ids) {
    const p = world.players[id];
    if (p) sum += overall(p);
  }
  return sum / ids.length;
}

/**
 * Project a final finishing order (best → worst) for a league we don't simulate
 * directly: squad strength plus a season's worth of seeded noise, so stronger
 * squads usually finish higher but upsets still happen. Ties break on club id
 * for determinism.
 */
export function projectLeagueOrder(world: World, leagueId: LeagueId, rng: Rng): ClubId[] {
  const ids = world.leagues[leagueId]?.clubIds ?? [];
  return ids
    .map((id) => ({ id, score: meanSquadOverall(world, id) + gaussian(rng, 0, PROJECTION_NOISE_SD) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((s) => s.id);
}

export interface PromotionOutcome {
  /** Clubs that moved up a tier this rollover. */
  promoted: ClubId[];
  /** Clubs that moved down a tier this rollover. */
  relegated: ClubId[];
}

/**
 * Apply promotion/relegation across one country's pyramid, given each league's
 * final finishing order (best → worst). For every adjacent pair of tiers the
 * bottom `slots` clubs of the upper league swap with the top `slots` clubs of
 * the lower league. League sizes are preserved (every tier sends and receives an
 * equal number with its neighbours). Mutates `world.clubs[*].leagueId` and each
 * affected `league.clubIds`. Returns who went up and down.
 */
export function applyPromotionRelegation(
  world: World,
  country: Country,
  finalOrders: Record<LeagueId, ClubId[]>,
  slots: number = PYRAMID.PROMOTION_SLOTS,
): PromotionOutcome {
  const tiers = country.leagueIds; // top → bottom
  const promoted: ClubId[] = [];
  const relegated: ClubId[] = [];
  // Compute every club's destination league from the pre-swap orders, then apply
  // all moves at once so reads never see a half-updated pyramid.
  const moveTo = new Map<ClubId, LeagueId>();

  for (let i = 0; i < tiers.length - 1; i++) {
    const upper = tiers[i];
    const lower = tiers[i + 1];
    const upperOrder = finalOrders[upper] ?? [];
    const lowerOrder = finalOrders[lower] ?? [];
    const n = Math.min(slots, Math.floor(upperOrder.length / 2), Math.floor(lowerOrder.length / 2));

    for (const id of upperOrder.slice(upperOrder.length - n)) {
      moveTo.set(id, lower);
      relegated.push(id);
    }
    for (const id of lowerOrder.slice(0, n)) {
      moveTo.set(id, upper);
      promoted.push(id);
    }
  }

  for (const [clubId, leagueId] of moveTo) {
    world.clubs[clubId].leagueId = leagueId;
  }

  // Rebuild each league's membership from a stable, id-sorted pool so the world
  // stays byte-identical across save/reload (fixture generation depends on the
  // clubIds array order).
  const pool = tiers
    .flatMap((id) => world.leagues[id].clubIds)
    .slice()
    .sort((a, b) => a.localeCompare(b));
  for (const leagueId of tiers) {
    world.leagues[leagueId].clubIds = pool.filter((id) => world.clubs[id].leagueId === leagueId);
  }

  return { promoted, relegated };
}

/**
 * What will happen to the user's club if the current league table stands: a club
 * in a promotion place (top `slots`, with a tier above) goes up, one in a
 * relegation place (bottom `slots`, with a tier below) goes down. The top flight
 * can't be promoted and the bottom tier can't be relegated. Uses the *real*
 * league table, so it matches exactly what `advanceSeason` will do to the user.
 */
export function projectedUserMovement(
  world: World,
  leagueId: LeagueId,
  userPosition: number,
  slots: number = PYRAMID.PROMOTION_SLOTS,
): Movement {
  const league = world.leagues[leagueId];
  const country = world.countries[league.countryId];
  const tierIndex = country ? country.leagueIds.indexOf(leagueId) : 0;
  const size = league.clubIds.length;
  const hasAbove = tierIndex > 0;
  const hasBelow = country ? tierIndex < country.leagueIds.length - 1 : false;

  if (userPosition >= 1 && userPosition <= slots && hasAbove) return 'promoted';
  if (userPosition > size - slots && hasBelow) return 'relegated';
  return 'stayed';
}
