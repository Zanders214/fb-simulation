import { effectiveArea } from './attrs';
import { SIM } from './config';
import { computeRating } from './ratings';
import { pickWeightedIndex, poisson, randInt, type Rng } from './rng';
import type {
  ClubId,
  GoalEvent,
  GoalType,
  MatchResult,
  Player,
  PlayerRating,
  SquadRoles,
  TeamMatchStats,
} from './types';
import { clamp, logistic } from './util';

export interface SimTeam {
  clubId: ClubId;
  players: Player[]; // the XI (ideally 11; engine tolerates fewer)
  roles: SquadRoles;
  homeAdvantage: boolean;
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
  forcedScorer?: Player;
}

/** Classify one chance (penalty / free kick / open play). Consumes exactly one Rng draw. */
function classifyChance(
  rng: Rng,
  atkAreas: Areas,
  defAreas: Areas,
  shooters: Player[],
  penTaker: Player | undefined,
  fkTaker: Player | undefined,
): ChanceKind {
  const roll = rng.next();
  if (roll < SIM.PEN_RATE) {
    return { type: 'penalty', pConv: SIM.P_PEN, forcedScorer: penTaker ?? bestAttacker(shooters) };
  }
  if (roll < SIM.PEN_RATE + SIM.FK_RATE) {
    const taker = fkTaker ?? bestAttacker(shooters);
    const pConv = clamp((SIM.P_FK_BASE * effectiveArea(taker, 'attacking')) / 100, 0.02, 0.3);
    return { type: 'free_kick', pConv, forcedScorer: taker };
  }
  return { type: 'open_play', pConv: convProb(atkAreas.atk, defAreas.def) };
}

/** Pick an assister for an open-play/header goal, or none. Consumes Rng draws. */
function pickAssist(rng: Rng, atk: SimTeam, scorerId: string): string | undefined {
  if (rng.next() >= SIM.P_ASSIST) return undefined;
  const others = atk.players.filter((p) => p.id !== scorerId);
  if (!others.length) return undefined;
  const aw = others.map((p) => effectiveArea(p, 'midfield') + 0.5 * effectiveArea(p, 'attacking'));
  return others[pickWeightedIndex(rng, aw)].id;
}

/** Simulate one team's attacking chances. Chance count is passed in (drawn earlier). */
function simulateSide(rng: Rng, atk: SimTeam, atkAreas: Areas, defAreas: Areas, chanceCount: number): SideOutcome {
  const outfield = atk.players.filter((p) => p.position !== 'GK');
  const shooters = outfield.length ? outfield : atk.players;
  const weights = shooters.map(goalWeight);
  const penTaker = findRole(atk, atk.roles.penaltyTakerId);
  const fkTaker = findRole(atk, atk.roles.freeKickTakerId);
  const events: GoalEvent[] = [];
  let xg = 0;

  for (let c = 0; c < chanceCount; c++) {
    const { type, pConv, forcedScorer } = classifyChance(rng, atkAreas, defAreas, shooters, penTaker, fkTaker);
    xg += pConv;
    if (rng.next() >= pConv) continue; // not scored

    const scorer = forcedScorer ?? shooters[pickWeightedIndex(rng, weights)] ?? shooters[0];

    let goalType: GoalType = type;
    if (type === 'open_play' && rng.next() < SIM.HEADER_SHARE) goalType = 'header';

    const assistId =
      goalType === 'open_play' || goalType === 'header' ? pickAssist(rng, atk, scorer.id) : undefined;

    const minute = randInt(rng, 1, 90);
    events.push({ minute, clubId: atk.clubId, scorerId: scorer.id, assistId, type: goalType });
  }

  return { events, xg };
}

/**
 * Simulate a full match instantly and deterministically (given the injected
 * Rng). Returns the score, ordered goal events, per-player ratings, and a stats
 * panel. The RNG is consumed in a FIXED order so the same seed always
 * reproduces the same match — important for tests and save/replay.
 */
export function simulateMatch(input: SimInput): MatchResult {
  const { home, away, rng } = input;
  const H = teamAreas(home);
  const A = teamAreas(away);

  const possHome = logistic((H.mid - A.mid) / SIM.MID_TEMP);
  const possAway = 1 - possHome;
  const edgeHome = H.atk / (H.atk + A.def);
  const edgeAway = A.atk / (A.atk + H.def);
  const lamHome = SIM.BASE_CHANCES * (0.5 + possHome) * (0.6 + 0.8 * edgeHome);
  const lamAway = SIM.BASE_CHANCES * (0.5 + possAway) * (0.6 + 0.8 * edgeAway);

  // Draw chance counts first to keep RNG order stable, then resolve each side.
  const chancesHome = poisson(rng, lamHome);
  const chancesAway = poisson(rng, lamAway);
  const homeOut = simulateSide(rng, home, H, A, chancesHome);
  const awayOut = simulateSide(rng, away, A, H, chancesAway);

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

  // ratings (home XI then away XI, fixed order)
  const ratings: Record<string, PlayerRating> = {};
  const rate = (team: SimTeam, own: Areas, opp: Areas, ownGoals: number, oppGoals: number) => {
    const teamWon = ownGoals > oppGoals;
    const teamDrew = ownGoals === oppGoals;
    for (const p of team.players) {
      const jitter = (rng.next() - 0.5) * SIM.RATING_JITTER;
      const goals = goalsBy[p.id] ?? 0;
      const assists = assistsBy[p.id] ?? 0;
      const rating = computeRating({
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
      ratings[p.id] = { playerId: p.id, rating, goals, assists };
    }
  };
  rate(home, H, A, homeGoals, awayGoals);
  rate(away, A, H, awayGoals, homeGoals);

  const homeStats: TeamMatchStats = { possession: possHome, chances: chancesHome, xg: homeOut.xg, goals: homeGoals };
  const awayStats: TeamMatchStats = { possession: possAway, chances: chancesAway, xg: awayOut.xg, goals: awayGoals };

  return {
    homeClubId: home.clubId,
    awayClubId: away.clubId,
    homeGoals,
    awayGoals,
    events,
    ratings,
    stats: { home: homeStats, away: awayStats },
  };
}
