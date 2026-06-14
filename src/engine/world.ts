import { overall } from './attrs';
import { DEFAULT_FORMATION, FORMATIONS, TRAINING } from './config';
import type { ClubId, Formation, Player, Position, SquadConfig, SquadRoles, World } from './types';

const SLOT_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

function clubPlayers(world: World, clubId: ClubId): Player[] {
  return world.clubs[clubId].playerIds.map((id) => world.players[id]).filter(Boolean);
}

const byOverallDesc = (a: Player, b: Player) => overall(b) - overall(a);
const byAttackingDesc = (a: Player, b: Player) => (b.attrs.attacking ?? 0) - (a.attrs.attacking ?? 0);

/**
 * Pick a sensible starting XI + bench + roles for a club, filling the formation
 * with the best players per position and falling back to best-available when a
 * position is short. Used for the user's initial squad and for every AI club.
 */
export function autoPickSquad(world: World, clubId: ClubId, formation: Formation = DEFAULT_FORMATION): SquadConfig {
  const players = clubPlayers(world, clubId);
  const need = FORMATIONS[formation];
  const used = new Set<string>();
  const xi: Player[] = [];

  for (const pos of SLOT_ORDER) {
    const pool = players.filter((p) => p.position === pos).sort(byOverallDesc);
    for (let i = 0; i < need[pos] && i < pool.length; i++) {
      xi.push(pool[i]);
      used.add(pool[i].id);
    }
  }
  if (xi.length < 11) {
    const rest = players.filter((p) => !used.has(p.id)).sort(byOverallDesc);
    for (const p of rest) {
      if (xi.length >= 11) break;
      xi.push(p);
      used.add(p.id);
    }
  }

  const startingXI = xi.slice(0, 11).map((p) => p.id);
  const bench = players
    .filter((p) => !used.has(p.id))
    .sort(byOverallDesc)
    .slice(0, 7)
    .map((p) => p.id);

  const xiPlayers = startingXI.map((id) => world.players[id]);
  const captainId = xiPlayers.slice().sort(byOverallDesc)[0]?.id;
  const forwards = xiPlayers.filter((p) => p.position === 'FWD');
  const creators = xiPlayers.filter((p) => p.position === 'FWD' || p.position === 'MID');
  const penaltyTakerId = (forwards.length ? forwards : xiPlayers).slice().sort(byAttackingDesc)[0]?.id;
  const freeKickTakerId = (creators.length ? creators : xiPlayers).slice().sort(byAttackingDesc)[0]?.id;

  return { formation, startingXI, bench, roles: { captainId, penaltyTakerId, freeKickTakerId } };
}

export type XIIssueType = 'count' | 'duplicate' | 'not-owned' | 'no-gk' | 'off-position' | 'role-not-in-xi';

export interface XIIssue {
  type: XIIssueType;
  message: string;
  /** Off-position is a soft warning (allowed with a rating penalty); the rest are hard errors. */
  severity: 'error' | 'warning';
}

/** Validate a lineup. Returns all issues (errors + warnings); empty/warnings-only means playable. */
export function validateXI(world: World, squad: SquadConfig, clubId: ClubId): XIIssue[] {
  const issues: XIIssue[] = [];
  const owned = new Set(world.clubs[clubId].playerIds);
  const xi = squad.startingXI;

  if (xi.length !== 11) {
    issues.push({ type: 'count', message: `Starting XI must have 11 players (has ${xi.length}).`, severity: 'error' });
  }

  const seen = new Set<string>();
  for (const id of xi) {
    if (seen.has(id)) {
      issues.push({ type: 'duplicate', message: 'A player is selected twice.', severity: 'error' });
    }
    seen.add(id);
    if (!owned.has(id)) {
      issues.push({ type: 'not-owned', message: 'A selected player is not in your squad.', severity: 'error' });
    }
  }

  const players = xi.map((id) => world.players[id]).filter(Boolean);
  const gkCount = players.filter((p) => p.position === 'GK').length;
  if (gkCount !== 1) {
    issues.push({ type: 'no-gk', message: `You need exactly one goalkeeper (have ${gkCount}).`, severity: 'error' });
  }

  const need = FORMATIONS[squad.formation];
  const have: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) have[p.position]++;
  for (const pos of ['DEF', 'MID', 'FWD'] as Position[]) {
    if (have[pos] !== need[pos]) {
      issues.push({
        type: 'off-position',
        message: `${squad.formation} expects ${need[pos]} ${pos}, you have ${have[pos]}.`,
        severity: 'warning',
      });
    }
  }

  const xiSet = new Set(xi);
  const roleChecks: [keyof SquadRoles, string][] = [
    ['captainId', 'Captain'],
    ['penaltyTakerId', 'Penalty taker'],
    ['freeKickTakerId', 'Free-kick taker'],
  ];
  for (const [key, label] of roleChecks) {
    const id = squad.roles[key];
    if (id && !xiSet.has(id)) {
      issues.push({ type: 'role-not-in-xi', message: `${label} is not in the starting XI.`, severity: 'error' });
    }
  }

  return issues;
}

/** True if the lineup has no hard errors (warnings like off-position are allowed). */
export function isPlayableXI(world: World, squad: SquadConfig, clubId: ClubId): boolean {
  return validateXI(world, squad, clubId).every((i) => i.severity !== 'error');
}

// ---- small pure reducers used by the UI ----

export function setFormation(squad: SquadConfig, formation: Formation): SquadConfig {
  return { ...squad, formation };
}

export function setRole(squad: SquadConfig, role: keyof SquadRoles, playerId: PlayerIdOrUndefined): SquadConfig {
  return { ...squad, roles: { ...squad.roles, [role]: playerId } };
}

/**
 * Toggle a player in or out of the training slots. Removing is always allowed;
 * adding is ignored once the slots are full (caps the squad at `max`). Returns a
 * new SquadConfig so the store can publish a fresh reference.
 */
export function toggleTraining(squad: SquadConfig, playerId: string, max: number = TRAINING.SLOTS): SquadConfig {
  const current = squad.trainingIds ?? [];
  if (current.includes(playerId)) {
    return { ...squad, trainingIds: current.filter((id) => id !== playerId) };
  }
  if (current.length >= max) return squad;
  return { ...squad, trainingIds: [...current, playerId] };
}

type PlayerIdOrUndefined = string | undefined;

/**
 * Drop a player from the tactical setup entirely: remove him from the starting
 * XI and bench, and clear any role he held. Used when a player leaves the club
 * (e.g. a transfer out) so the lineup never references an unowned player.
 */
export function removeFromSquad(squad: SquadConfig, playerId: string): SquadConfig {
  const roles: SquadRoles = { ...squad.roles };
  for (const key of Object.keys(roles) as (keyof SquadRoles)[]) {
    if (roles[key] === playerId) roles[key] = undefined;
  }
  return {
    ...squad,
    startingXI: squad.startingXI.filter((id) => id !== playerId),
    bench: squad.bench.filter((id) => id !== playerId),
    roles,
    trainingIds: squad.trainingIds?.filter((id) => id !== playerId),
  };
}

/**
 * Swap a player who is currently on the bench (or unused) into the XI in place
 * of a starter, keeping slot order. Any roles (captain, penalty/free-kick taker)
 * held by the outgoing player transfer to the incoming one, so the XI never ends
 * up with a role assigned to a benched player. Returns a new SquadConfig.
 */
export function swapPlayer(squad: SquadConfig, outId: string, inId: string): SquadConfig {
  if (!squad.startingXI.includes(outId)) return squad;
  const startingXI = squad.startingXI.map((id) => (id === outId ? inId : id));
  const bench = squad.bench.map((id) => (id === inId ? outId : id));
  if (!squad.bench.includes(inId)) bench.push(outId);
  const roles = { ...squad.roles };
  for (const key of Object.keys(roles) as (keyof SquadRoles)[]) {
    if (roles[key] === outId) roles[key] = inId;
  }
  return { ...squad, startingXI, bench: bench.filter((id) => id !== inId), roles };
}

/**
 * Swap the pitch positions of two players who are both already in the starting
 * XI by exchanging their slots. Roles stay with the players (both remain in the
 * XI), so nothing else changes. Returns a new SquadConfig.
 */
export function swapStarters(squad: SquadConfig, aId: string, bId: string): SquadConfig {
  const ai = squad.startingXI.indexOf(aId);
  const bi = squad.startingXI.indexOf(bId);
  if (ai === -1 || bi === -1 || ai === bi) return squad;
  const startingXI = squad.startingXI.slice();
  startingXI[ai] = bId;
  startingXI[bi] = aId;
  return { ...squad, startingXI };
}
