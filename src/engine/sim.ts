import { effectiveArea, overall } from './attrs';
import { INJURY, SIM, SUBS } from './config';
import { computeRating } from './ratings';
import { pickWeightedIndex, poisson, randInt, type Rng } from './rng';
import type {
  CardEvent,
  ClubId,
  GoalEvent,
  GoalType,
  InjuryEvent,
  MatchResult,
  Player,
  PlayerRating,
  Position,
  SquadRoles,
  SubEvent,
  TeamMatchStats,
} from './types';
import { clamp, logistic, round1 } from './util';

export interface SimTeam {
  clubId: ClubId;
  players: Player[]; // the starting XI (ideally 11; engine tolerates fewer)
  bench?: Player[]; // available substitutes (empty/absent => no subs are made)
  roles: SquadRoles;
  homeAdvantage: boolean;
}

/** A player on the pitch and the fraction of the match (0..1) he was on for. */
interface OnPitch {
  player: Player;
  fraction: number;
}

export interface SimInput {
  home: SimTeam;
  away: SimTeam;
  rng: Rng;
}

interface Areas {
  atk: number;
  def: number;
  mid: number;
}

function teamAreas(team: SimTeam): Areas {
  let atkNum = 0;
  let atkDen = 0;
  let defNum = 0;
  let defDen = 0;
  let midNum = 0;
  let midDen = 0;
  let gk: Player | undefined;

  for (const p of team.players) {
    const a = effectiveArea(p, 'attacking');
    const d = effectiveArea(p, 'defending');
    const m = effectiveArea(p, 'midfield');
    atkNum += SIM.wAtk[p.position] * a;
    atkDen += SIM.wAtk[p.position];
    midNum += SIM.wMid[p.position] * m;
    midDen += SIM.wMid[p.position];
    if (p.position !== 'GK') {
      defNum += SIM.wDef[p.position] * d;
      defDen += SIM.wDef[p.position];
    }
    if (p.position === 'GK' && !gk) gk = p;
  }

  let atk = atkDen > 0 ? atkNum / atkDen : 40;
  let mid = midDen > 0 ? midNum / midDen : 40;
  const outDef = defDen > 0 ? defNum / defDen : 40;
  const gkDef = gk ? effectiveArea(gk, 'defending') : outDef;
  let def = (1 - SIM.GK_DEF_BLEND) * outDef + SIM.GK_DEF_BLEND * gkDef;

  const captain = team.players.find((p) => p.id === team.roles.captainId);
  if (captain) {
    const m = clamp(
      1 + (SIM.CAPTAIN_MORALE_MAX * (effectiveArea(captain, 'midfield') - 50)) / 50,
      1 - SIM.CAPTAIN_MORALE_MAX,
      1 + SIM.CAPTAIN_MORALE_MAX,
    );
    atk *= m;
    mid *= m;
  }

  if (team.homeAdvantage) {
    atk *= SIM.HOME_ATK_MULT;
    def *= SIM.HOME_DEF_MULT;
  }

  return { atk, def, mid };
}

function convProb(atkShoot: number, defDefend: number): number {
  const ratio = atkShoot / Math.max(1, defDefend);
  return clamp(SIM.BASE_CONV * Math.pow(ratio, SIM.CONV_EXP), SIM.CONV_MIN, SIM.CONV_MAX);
}

function goalWeight(p: Player): number {
  return Math.pow(effectiveArea(p, 'attacking'), SIM.SCORER_ATK_EXP) * SIM.posScoreMult[p.position];
}

function findRole(team: SimTeam, id?: string): Player | undefined {
  if (!id) return undefined;
  return team.players.find((p) => p.id === id);
}

function bestAttacker(players: Player[]): Player {
  return players.reduce(
    (best, p) => (effectiveArea(p, 'attacking') > effectiveArea(best, 'attacking') ? p : best),
    players[0],
  );
}

interface SideOutcome {
  events: GoalEvent[];
  xg: number;
}

interface ChanceKind {
  type: GoalType;
  pConv: number;
}

/**
 * Classify one chance (penalty / free kick / open play). Consumes exactly one Rng
 * draw. The free-kick conversion is scaled by the designated taker's skill (the
 * original role-holder, for the probability only); WHO is credited is resolved
 * later from the on-pitch lineup at the goal's minute.
 */
function classifyChance(rng: Rng, atkAreas: Areas, defAreas: Areas, shooters: Player[], fkTaker: Player | undefined): ChanceKind {
  const roll = rng.next();
  if (roll < SIM.PEN_RATE) return { type: 'penalty', pConv: SIM.P_PEN };
  if (roll < SIM.PEN_RATE + SIM.FK_RATE) {
    const taker = fkTaker ?? bestAttacker(shooters);
    const pConv = clamp((SIM.P_FK_BASE * effectiveArea(taker, 'attacking')) / 100, 0.02, 0.3);
    return { type: 'free_kick', pConv };
  }
  return { type: 'open_play', pConv: convProb(atkAreas.atk, defAreas.def) };
}

/**
 * The player holding a set-piece role at a given minute: the designated taker
 * while he is on, otherwise the substitute who came on for him (following the
 * chain if that sub is later replaced too). Returns undefined when he left
 * without a replacement (a sending-off or an unreplaced injury) or never played,
 * so the caller can fall back to the best attacker on the pitch.
 */
function activeTaker(roleId: string | undefined, part: Participation, byId: Map<string, Player>, minute: number): Player | undefined {
  if (!roleId) return undefined;
  let id = roleId;
  for (let guard = 0; guard < 12; guard++) {
    const left = part.leftAt.get(id);
    if (left === undefined || minute < left) return byId.get(id); // still on at this minute
    const sub = part.subs.find((s) => s.offPlayerId === id);
    if (!sub) return undefined; // left with no replacement
    id = sub.onPlayerId;
  }
  return byId.get(id);
}

/** Pick an assister for an open-play/header goal, or none. Consumes Rng draws. */
function pickAssist(rng: Rng, onPitch: OnPitch[], scorerId: string): string | undefined {
  if (rng.next() >= SIM.P_ASSIST) return undefined;
  const others = onPitch.filter((o) => o.player.id !== scorerId);
  if (!others.length) return undefined;
  // weight by creativity AND time on the pitch, so a late sub assists rarely
  const aw = others.map((o) => (effectiveArea(o.player, 'midfield') + 0.5 * effectiveArea(o.player, 'attacking')) * o.fraction);
  return others[pickWeightedIndex(rng, aw)].player.id;
}

/**
 * Simulate one team's attacking chances. Chance count is passed in (drawn
 * earlier). Scorers and assisters are drawn from everyone who appeared (starters
 * AND substitutes), each weighted by their time on the pitch — so a substitute
 * can score, in proportion to the minutes he played.
 */
function simulateSide(rng: Rng, atk: SimTeam, part: Participation, atkAreas: Areas, defAreas: Areas, chanceCount: number): SideOutcome {
  const onPitch = part.onPitch;
  const outfield = onPitch.filter((o) => o.player.position !== 'GK');
  const pool = outfield.length ? outfield : onPitch;
  const shooters = pool.map((o) => o.player);
  const weights = pool.map((o) => goalWeight(o.player) * o.fraction);
  const byId = new Map(onPitch.map((o) => [o.player.id, o.player] as const));
  const fkTaker = findRole(atk, atk.roles.freeKickTakerId);
  const events: GoalEvent[] = [];
  let xg = 0;

  // Who is credited with a chance, resolved from the lineup at the goal's minute:
  // the set-piece role's active holder (taker -> his substitute -> best attacker).
  const scorerFor = (type: GoalType, minute: number): Player => {
    if (type === 'penalty') return activeTaker(atk.roles.penaltyTakerId, part, byId, minute) ?? bestAttacker(shooters);
    if (type === 'free_kick') return activeTaker(atk.roles.freeKickTakerId, part, byId, minute) ?? bestAttacker(shooters);
    return shooters[pickWeightedIndex(rng, weights)] ?? shooters[0];
  };

  for (let c = 0; c < chanceCount; c++) {
    const { type, pConv } = classifyChance(rng, atkAreas, defAreas, shooters, fkTaker);
    xg += pConv;
    if (rng.next() >= pConv) continue; // not scored

    const minute = randInt(rng, 1, 90); // drawn before the scorer so set-piece duty follows the clock
    const scorer = scorerFor(type, minute);

    let goalType: GoalType = type;
    if (type === 'open_play' && rng.next() < SIM.HEADER_SHARE) goalType = 'header';

    const assistId =
      goalType === 'open_play' || goalType === 'header' ? pickAssist(rng, onPitch, scorer.id) : undefined;

    events.push({ minute, clubId: atk.clubId, scorerId: scorer.id, assistId, type: goalType });
  }

  return { events, xg };
}

const byMinute = (a: { minute: number }, b: { minute: number }) => a.minute - b.minute;

/**
 * Book cards for one team. Each bookable incident falls on a player weighted by
 * position (defenders/midfielders foul more). A fresh incident is almost always a
 * first yellow (rarely a straight red); a player who is already booked usually
 * gets away with it, occasionally collecting a second yellow that becomes a red.
 * A sent-off player takes no further cards. Consumes a fixed three Rng draws per
 * incident, so match RNG order stays stable.
 */
function simulateCards(rng: Rng, team: SimTeam): CardEvent[] {
  const n = poisson(rng, SIM.CARD_LAMBDA);
  if (n === 0 || team.players.length === 0) return [];
  const weights = team.players.map((p) => SIM.cardPropensity[p.position]);
  const booked = new Set<string>(); // already on a yellow
  const sentOff = new Set<string>();
  const events: CardEvent[] = [];

  for (let i = 0; i < n; i++) {
    const player = team.players[pickWeightedIndex(rng, weights)];
    const roll = rng.next();
    const minute = randInt(rng, 1, 90);
    if (sentOff.has(player.id)) continue; // already off — the incident is dead air

    if (roll < SIM.STRAIGHT_RED_SHARE) {
      sentOff.add(player.id);
      events.push({ minute, clubId: team.clubId, playerId: player.id, type: 'red' });
      continue;
    }
    if (booked.has(player.id)) {
      // a second bookable offence — usually let off, occasionally a second yellow
      if (roll < SIM.STRAIGHT_RED_SHARE + SIM.SECOND_YELLOW_SHARE) {
        sentOff.add(player.id);
        events.push({ minute, clubId: team.clubId, playerId: player.id, type: 'red', secondYellow: true });
      }
      continue;
    }
    booked.add(player.id);
    events.push({ minute, clubId: team.clubId, playerId: player.id, type: 'yellow' });
  }
  return events.sort(byMinute);
}

/** Pick how many matchdays an injury keeps a player out, by weighted severity band. */
function injuryDuration(rng: Rng): number {
  const roll = rng.next();
  const within = rng.next();
  let cum = 0;
  for (const band of INJURY.BANDS) {
    cum += band.weight;
    if (roll < cum) return band.min + Math.floor(within * (band.max - band.min + 1));
  }
  const last = INJURY.BANDS[INJURY.BANDS.length - 1];
  return last.min + Math.floor(within * (last.max - last.min + 1));
}

/** Injure zero or more of a team's players this match. Four fixed Rng draws each. */
function simulateInjuries(rng: Rng, team: SimTeam): InjuryEvent[] {
  const n = poisson(rng, INJURY.LAMBDA);
  if (n === 0 || team.players.length === 0) return [];
  const hurt = new Set<string>();
  const events: InjuryEvent[] = [];

  for (let i = 0; i < n; i++) {
    const player = team.players[randInt(rng, 0, team.players.length - 1)];
    const matchesOut = injuryDuration(rng);
    const minute = randInt(rng, 1, 90);
    if (hurt.has(player.id)) continue;
    hurt.add(player.id);
    events.push({ minute, clubId: team.clubId, playerId: player.id, matchesOut });
  }
  return events.sort(byMinute);
}

interface Participation {
  /** Time-weighted areas across the substitution timeline (before any man-down hit). */
  areas: Areas;
  /** Everyone who appeared (starters + substitutes) with their on-pitch fraction. */
  onPitch: OnPitch[];
  /** Substitution events for this team, sorted by minute. */
  subs: SubEvent[];
  /** Minutes a player left WITHOUT replacement (a red, or an injury after subs ran out). */
  offMinutes: number[];
  /** Minute each departing player left the pitch (subbed, sent off, or unreplaced injury). */
  leftAt: Map<string, number>;
}

/** Take the best fit substitute of a position from the bench (else best overall), removing him. */
function takeBench(bench: Player[], position: Position): Player | undefined {
  if (bench.length === 0) return undefined;
  let idx = bench.findIndex((p) => p.position === position);
  if (idx < 0) idx = 0; // bench is sorted best-first, so [0] is the best available
  return bench.splice(idx, 1)[0];
}

/** Draw how many substitutions a team intends to make (mean ≈ 4, capped at MAX). One Rng draw. */
function drawSubTarget(rng: Rng): number {
  const u = rng.next();
  const t = SUBS.TARGET_THRESHOLDS;
  for (let i = 0; i < t.length; i++) if (u < t[i]) return 2 + i;
  return 2 + t.length;
}

/** Time-weighted team areas across the lineup as substitutions are made. */
function effectiveAreasOverSubs(team: SimTeam, subs: SubEvent[]): Areas {
  const byId = new Map<string, Player>();
  for (const p of team.players) byId.set(p.id, p);
  for (const p of team.bench ?? []) byId.set(p.id, p);

  let lineupIds = team.players.map((p) => p.id);
  const acc: Areas = { atk: 0, mid: 0, def: 0 };
  let prev = 0;
  const addSegment = (toMin: number) => {
    const frac = (toMin - prev) / 90;
    if (frac <= 0) return;
    const players = lineupIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
    const a = teamAreas({ ...team, players });
    acc.atk += frac * a.atk;
    acc.mid += frac * a.mid;
    acc.def += frac * a.def;
  };
  for (const s of subs) {
    addSegment(s.minute);
    lineupIds = lineupIds.map((id) => (id === s.offPlayerId ? s.onPlayerId : id));
    prev = s.minute;
  }
  addSegment(90);
  return acc;
}

/**
 * Weaken a team's areas for the share of the match it plays a man down. A man
 * down late on barely moves the numbers; early on it cuts attack, midfield and
 * defence sharply (which in turn lifts the opponent's chances and conversion,
 * since those read this team's def/mid). Multiple departures stack. Mutates `areas`.
 */
function applyManDown(areas: Areas, offMinutes: number[]): void {
  let fracDown = 0;
  for (const m of offMinutes) fracDown += (90 - m) / 90;
  if (fracDown <= 0) return;
  const mult = Math.max(0, 1 - fracDown * SIM.RED_STRENGTH_PENALTY);
  areas.atk *= mult;
  areas.mid *= mult;
  areas.def *= mult;
}

/** Mutable working state while planning one team's substitutions. */
interface SubPlan {
  team: SimTeam;
  byId: Map<string, Player>;
  bench: Player[]; // available subs, best first; shrinks as used
  onPitch: Set<string>; // original starters still on the pitch
  leftAt: Map<string, number>; // playerId -> minute he went off
  cameOn: { player: Player; minute: number }[];
  subs: SubEvent[];
  offMinutes: number[]; // departures with no replacement (man down)
  subsUsed: number;
}

/** Mark a player as having left the pitch at `minute`. */
function recordOff(plan: SubPlan, id: string, minute: number): void {
  plan.onPitch.delete(id);
  plan.leftAt.set(id, minute);
}

/** Try to replace `off` from the bench within the cap. Returns whether a sub came on. */
function bringOn(plan: SubPlan, off: Player, minute: number): boolean {
  const on = plan.subsUsed < SUBS.MAX ? takeBench(plan.bench, off.position) : undefined;
  if (!on) return false;
  plan.subs.push({ minute, clubId: plan.team.clubId, offPlayerId: off.id, onPlayerId: on.id });
  plan.cameOn.push({ player: on, minute });
  plan.subsUsed++;
  return true;
}

/** Sendings-off leave the team a man down, never replaced. */
function applyReds(plan: SubPlan, reds: CardEvent[]): void {
  for (const r of reds) {
    if (!plan.onPitch.has(r.playerId)) continue;
    recordOff(plan, r.playerId, r.minute);
    plan.offMinutes.push(r.minute);
  }
}

/** Injuries are substituted if a slot remains, otherwise the team finishes short-handed. */
function applyInjuries(plan: SubPlan, injuries: InjuryEvent[]): void {
  for (const inj of [...injuries].sort(byMinute)) {
    const off = plan.byId.get(inj.playerId);
    if (!off || !plan.onPitch.has(inj.playerId)) continue; // already off (red, etc.)
    recordOff(plan, inj.playerId, inj.minute);
    if (!bringOn(plan, off, inj.minute)) plan.offMinutes.push(inj.minute);
  }
}

/** Tactical subs up to the target, swapping a random outfield starter for the best bench fit. */
function applyTacticalSubs(rng: Rng, plan: SubPlan): void {
  const target = drawSubTarget(rng);
  while (plan.subsUsed < target && plan.bench.length > 0) {
    const eligible = [...plan.onPitch].map((id) => plan.byId.get(id)!).filter((p) => p.position !== 'GK');
    if (eligible.length === 0) break;
    const off = eligible[randInt(rng, 0, eligible.length - 1)];
    const minute = randInt(rng, SUBS.MIN_MINUTE, SUBS.MAX_MINUTE);
    recordOff(plan, off.id, minute);
    bringOn(plan, off, minute); // guaranteed: bench non-empty and subsUsed < target <= MAX
  }
}

/**
 * Plan one team's match participation: who leaves and when (sendings-off, then
 * injuries — substituted if a slot remains, else a man down), then tactical subs
 * up to a realistic target. Produces the sub events, the man-down minutes, the
 * time-weighted areas and each player's fraction of the match on the pitch.
 * Consumes a deterministic, bounded number of Rng draws.
 */
function planParticipation(rng: Rng, team: SimTeam, reds: CardEvent[], injuries: InjuryEvent[]): Participation {
  const plan: SubPlan = {
    team,
    byId: new Map(team.players.map((p) => [p.id, p] as const)),
    bench: (team.bench ?? []).slice().sort((a, b) => overall(b) - overall(a)),
    onPitch: new Set(team.players.map((p) => p.id)),
    leftAt: new Map(),
    cameOn: [],
    subs: [],
    offMinutes: [],
    subsUsed: 0,
  };

  applyReds(plan, reds);
  applyInjuries(plan, injuries);
  applyTacticalSubs(rng, plan);
  plan.subs.sort(byMinute);

  const onPitch: OnPitch[] = [];
  for (const p of team.players) {
    const left = plan.leftAt.get(p.id);
    onPitch.push({ player: p, fraction: left === undefined ? 1 : left / 90 });
  }
  for (const { player, minute } of plan.cameOn) {
    onPitch.push({ player, fraction: (90 - minute) / 90 });
  }

  return { areas: effectiveAreasOverSubs(team, plan.subs), onPitch, subs: plan.subs, offMinutes: plan.offMinutes, leftAt: plan.leftAt };
}

/**
 * Simulate a full match instantly and deterministically (given the injected
 * Rng). Returns the score, ordered goal events, cards, injuries, per-player
 * ratings, and a stats panel. The RNG is consumed in a FIXED order so the same
 * seed always reproduces the same match — important for tests and save/replay.
 */
export function simulateMatch(input: SimInput): MatchResult {
  const { home, away, rng } = input;

  // RNG order: cards -> injuries -> substitutions -> chances -> ratings. Cards and
  // injuries are resolved first because a sending-off or a forced/failed sub
  // changes who is on the pitch (and how strong the team is) for the rest of the
  // match, all of which must be known before chances are generated.
  const cards = [...simulateCards(rng, home), ...simulateCards(rng, away)].sort(byMinute);
  const injuries = [...simulateInjuries(rng, home), ...simulateInjuries(rng, away)].sort(byMinute);

  const redsOf = (clubId: ClubId) => cards.filter((c) => c.type === 'red' && c.clubId === clubId);
  const injOf = (clubId: ClubId) => injuries.filter((i) => i.clubId === clubId);
  const partHome = planParticipation(rng, home, redsOf(home.clubId), injOf(home.clubId));
  const partAway = planParticipation(rng, away, redsOf(away.clubId), injOf(away.clubId));
  const subs = [...partHome.subs, ...partAway.subs].sort(byMinute);

  // effective (time-weighted) areas, then the man-down hit for anyone unreplaced
  const H = partHome.areas;
  const A = partAway.areas;
  applyManDown(H, partHome.offMinutes);
  applyManDown(A, partAway.offMinutes);

  const possHome = logistic((H.mid - A.mid) / SIM.MID_TEMP);
  const possAway = 1 - possHome;
  const edgeHome = H.atk / (H.atk + A.def);
  const edgeAway = A.atk / (A.atk + H.def);
  const lamHome = SIM.BASE_CHANCES * (0.5 + possHome) * (0.6 + 0.8 * edgeHome);
  const lamAway = SIM.BASE_CHANCES * (0.5 + possAway) * (0.6 + 0.8 * edgeAway);

  // Draw chance counts first to keep RNG order stable, then resolve each side.
  const chancesHome = poisson(rng, lamHome);
  const chancesAway = poisson(rng, lamAway);
  const homeOut = simulateSide(rng, home, partHome, H, A, chancesHome);
  const awayOut = simulateSide(rng, away, partAway, A, H, chancesAway);

  const events = [...homeOut.events, ...awayOut.events].sort((a, b) => a.minute - b.minute);
  const homeGoals = homeOut.events.length;
  const awayGoals = awayOut.events.length;

  // tally goals/assists
  const goalsBy: Record<string, number> = {};
  const assistsBy: Record<string, number> = {};
  for (const e of events) {
    goalsBy[e.scorerId] = (goalsBy[e.scorerId] ?? 0) + 1;
    if (e.assistId) assistsBy[e.assistId] = (assistsBy[e.assistId] ?? 0) + 1;
  }

  // ratings: everyone who appeared (starters + subs), home then away. A red-carded
  // player is docked, which carries through to his development.
  const ratings: Record<string, PlayerRating> = {};
  const rate = (team: SimTeam, part: Participation, own: Areas, opp: Areas, ownGoals: number, oppGoals: number) => {
    const teamWon = ownGoals > oppGoals;
    const teamDrew = ownGoals === oppGoals;
    const sentOff = new Set(redsOf(team.clubId).map((c) => c.playerId));
    for (const { player: p } of part.onPitch) {
      const jitter = (rng.next() - 0.5) * SIM.RATING_JITTER;
      const goals = goalsBy[p.id] ?? 0;
      const assists = assistsBy[p.id] ?? 0;
      let rating = computeRating({
        player: p,
        goals,
        assists,
        teamWon,
        teamDrew,
        cleanSheet: oppGoals === 0,
        goalsConceded: oppGoals,
        ownAtk: own.atk,
        ownDef: own.def,
        ownMid: own.mid,
        oppAtk: opp.atk,
        oppDef: opp.def,
        oppMid: opp.mid,
        jitter,
      });
      if (sentOff.has(p.id)) rating = round1(clamp(rating - SIM.RED_CARD_RATING_PENALTY, 1, 10));
      ratings[p.id] = { playerId: p.id, rating, goals, assists };
    }
  };
  rate(home, partHome, H, A, homeGoals, awayGoals);
  rate(away, partAway, A, H, awayGoals, homeGoals);

  const homeStats: TeamMatchStats = { possession: possHome, chances: chancesHome, xg: homeOut.xg, goals: homeGoals };
  const awayStats: TeamMatchStats = { possession: possAway, chances: chancesAway, xg: awayOut.xg, goals: awayGoals };

  return {
    homeClubId: home.clubId,
    awayClubId: away.clubId,
    homeGoals,
    awayGoals,
    events,
    cards,
    injuries,
    subs,
    ratings,
    stats: { home: homeStats, away: awayStats },
  };
}
