/**
 * Transfer market logic: player valuation, club budgets, and the buy/sell
 * operations. Pure and deterministic — like the rest of the engine it mutates
 * the passed GameState/World in place and never touches React or storage.
 */
import { overall } from './attrs';
import { CONTENT, MARKET } from './config';
import type { ClubId, GameState, Player, PlayerId, World } from './types';
import { clamp } from './util';
import { removeFromSquad } from './world';

/** Round a money amount (thousands) to the nearest €0.1M. */
function roundTo100(x: number): number {
  return Math.round(x / 100) * 100;
}

/** Value multiplier by age: peaks in the early-mid 20s, tails off with decline. */
function ageMult(age: number): number {
  if (age <= 20) return 1.1;
  if (age <= 23) return 1.15;
  if (age <= 27) return 1;
  if (age <= 30) return 0.8;
  if (age <= 32) return 0.55;
  if (age <= 34) return 0.35;
  return 0.2;
}

/**
 * Estimated transfer value of a player, in thousands. Convex in overall (stars
 * cost disproportionately more), scaled by age, with a premium for unrealised
 * potential. Monotonic in overall at a fixed age; never below €250K.
 */
export function playerValue(player: Player): number {
  const ovr = overall(player);
  const t = clamp((ovr - MARKET.VAL_FLOOR_OVR) / (99 - MARKET.VAL_FLOOR_OVR), 0, 1);
  const base = Math.pow(t, MARKET.VAL_EXP) * MARKET.VAL_SCALE;
  const headroom = Math.max(0, player.potential - ovr);
  const potMult = 1 + (MARKET.POT_PREMIUM * headroom) / 100;
  const raw = base * ageMult(player.age) * potMult;
  return Math.max(250, roundTo100(raw));
}

/** Starting transfer budget for a club, derived convexly from its reputation. */
export function initialBudget(reputation: number): number {
  const t = clamp((reputation - 40) / 60, 0, 1);
  return roundTo100(t * t * MARKET.BUDGET_SCALE + MARKET.BUDGET_FLOOR);
}

/**
 * Read a club's budget, falling back to a reputation-derived value for saves
 * created before budgets existed (so no save migration is required).
 */
export function clubBudget(world: World, clubId: ClubId): number {
  const club = world.clubs[clubId];
  return club.budget ?? initialBudget(club.reputation);
}

function squadSize(world: World, clubId: ClubId): number {
  return world.clubs[clubId].playerIds.length;
}

/** Move a player between clubs, keeping both clubs' `playerIds` consistent. */
export function transferPlayer(world: World, playerId: PlayerId, toClubId: ClubId): void {
  const player = world.players[playerId];
  if (!player || player.clubId === toClubId) return;
  const from = world.clubs[player.clubId];
  if (from) from.playerIds = from.playerIds.filter((id) => id !== playerId);
  const to = world.clubs[toClubId];
  if (!to.playerIds.includes(playerId)) to.playerIds.push(playerId);
  player.clubId = toClubId;
}

/**
 * Pick the AI club best placed to buy `player`: must have squad room and the
 * funds, preferring clubs short at the player's position, then by reputation.
 * Deterministic (ties broken by club id).
 */
export function findBuyer(world: World, player: Player, sellerClubId: ClubId): ClubId | undefined {
  const value = playerValue(player);
  const quota = CONTENT.POSITION_QUOTA[player.position];
  const candidates = Object.values(world.clubs).filter(
    (c) =>
      c.id !== sellerClubId &&
      c.playerIds.length < MARKET.MAX_SQUAD &&
      clubBudget(world, c.id) >= value,
  );
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => {
    const aShort = a.playerIds.filter((id) => world.players[id]?.position === player.position).length < quota;
    const bShort = b.playerIds.filter((id) => world.players[id]?.position === player.position).length < quota;
    if (aShort !== bShort) return aShort ? -1 : 1;
    if (a.reputation !== b.reputation) return b.reputation - a.reputation;
    return a.id.localeCompare(b.id);
  });
  return candidates[0].id;
}

export interface TransferResult {
  ok: boolean;
  reason?: string;
  /** Money that changed hands, in thousands. */
  fee?: number;
  player?: Player;
  /** The other club involved (seller on a buy, buyer on a sale). */
  otherClubId?: ClubId;
}

/**
 * Buy a player for the managed club at his market value. Validates squad caps
 * and funds; on success moves the player and adjusts both clubs' budgets. The
 * new player surfaces automatically as a reserve (squad screens derive
 * availability from club ownership, so no SquadConfig edit is needed).
 */
export function buyPlayer(state: GameState, playerId: PlayerId): TransferResult {
  const { world, managedClubId } = state;
  const player = world.players[playerId];
  if (!player) return { ok: false, reason: 'Player not found.' };
  if (player.clubId === managedClubId) return { ok: false, reason: 'You already own this player.' };
  if (squadSize(world, managedClubId) >= MARKET.MAX_SQUAD) {
    return { ok: false, reason: `Your squad is full (max ${MARKET.MAX_SQUAD}).` };
  }
  const sellerId = player.clubId;
  if (squadSize(world, sellerId) <= MARKET.MIN_SQUAD) {
    return { ok: false, reason: 'Their squad is too thin — they will not sell.' };
  }
  const fee = playerValue(player);
  if (clubBudget(world, managedClubId) < fee) {
    return { ok: false, reason: 'Not enough funds for this transfer.', fee };
  }

  world.clubs[managedClubId].budget = clubBudget(world, managedClubId) - fee;
  world.clubs[sellerId].budget = clubBudget(world, sellerId) + fee;
  transferPlayer(world, playerId, managedClubId);
  return { ok: true, fee, player, otherClubId: sellerId };
}

/**
 * Sell a player from the managed club to an interested AI club. Validates the
 * minimum squad size and that a buyer exists; on success removes the player
 * from the lineup, moves him, and credits the (discounted) sale proceeds.
 */
export function sellPlayer(state: GameState, playerId: PlayerId): TransferResult {
  const { world, managedClubId } = state;
  const player = world.players[playerId];
  if (player?.clubId !== managedClubId) {
    return { ok: false, reason: 'You do not own this player.' };
  }
  if (squadSize(world, managedClubId) <= MARKET.MIN_SQUAD) {
    return { ok: false, reason: `You must keep at least ${MARKET.MIN_SQUAD} players.` };
  }
  const value = playerValue(player);
  const buyerId = findBuyer(world, player, managedClubId);
  if (!buyerId) return { ok: false, reason: 'No club is interested right now.' };

  const proceeds = roundTo100(value * MARKET.SELL_RETURN);
  world.clubs[buyerId].budget = clubBudget(world, buyerId) - value;
  world.clubs[managedClubId].budget = clubBudget(world, managedClubId) + proceeds;
  state.squad = removeFromSquad(state.squad, playerId);
  transferPlayer(world, playerId, buyerId);
  return { ok: true, fee: proceeds, player, otherClubId: buyerId };
}
