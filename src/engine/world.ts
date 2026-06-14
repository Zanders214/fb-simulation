import { overall } from './attrs';
import { DEFAULT_FORMATION, FORMATIONS } from './config';
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
  };
}

/**
 * Remove a player who is leaving the club from the tactical setup, keeping the
 * starting XI full. If he was a starter, his slot is filled in place — preserving
 * the formation's slot order — by the best available owned replacement: the
 * highest-overall player of the same position, falling back to best-available
 * when none is left. The replacement is promoted out of the bench/reserves; any
 * role the departing player held is cleared. He is also dropped from the bench.
 *
 * `playerId` may still be listed in the club's `playerIds` (this is called before
 * the transfer is committed); he is always excluded from replacement candidates.
 */
export function replaceInSquad(world: World, squad: SquadConfig, clubId: ClubId, playerId: string): SquadConfig {
  const xiIndex = squad.startingXI.indexOf(playerId);
  if (xiIndex === -1) return removeFromSquad(squad, playerId);

  const inXI = new Set(squad.startingXI);
  const candidates = world.clubs[clubId].playerIds
    .filter((id) => id !== playerId && !inXI.has(id))
    .map((id) => world.players[id])
    .filter(Boolean);
  if (!candidates.length) return removeFromSquad(squad, playerId);

  const pos = world.players[playerId]?.position;
  const samePos = candidates.filter((p) => p.position === pos);
  const replacement = (samePos.length ? samePos : candidates).slice().sort(byOverallDesc)[0];

  const startingXI = squad.startingXI.slice();
  startingXI[xiIndex] = replacement.id;
  const roles: SquadRoles = { ...squad.roles };
  for (const key of Object.keys(roles) as (keyof SquadRoles)[]) {
    if (roles[key] === playerId) roles[key] = undefined;
  }
  return {
    ...squad,
    startingXI,
    bench: squad.bench.filter((id) => id !== playerId && id !== replacement.id),
    roles,
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
