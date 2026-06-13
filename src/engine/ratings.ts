import { SIM } from './config';
import type { Player } from './types';
import { clamp, round1 } from './util';

export interface RatingContext {
  player: Player;
  goals: number;
  assists: number;
  teamWon: boolean;
  teamDrew: boolean;
  cleanSheet: boolean;
  goalsConceded: number;
  ownAtk: number;
  ownDef: number;
  ownMid: number;
  oppAtk: number;
  oppDef: number;
  oppMid: number;
  /** Seeded ± jitter, drawn by the caller so the sim controls RNG order. */
  jitter: number;
}

/** Per-player match rating, 1.0..10.0. Anchored at 6.0 like real football ratings. */
export function computeRating(ctx: RatingContext): number {
  const pos = ctx.player.position;
  let r =
    SIM.RATING_BASE +
    SIM.GOAL_PTS * ctx.goals +
    SIM.ASSIST_PTS * ctx.assists +
    (ctx.teamWon ? SIM.RESULT_ADJ : ctx.teamDrew ? 0 : -SIM.RESULT_ADJ);

  if (pos === 'GK' || pos === 'DEF') {
    if (ctx.cleanSheet) r += SIM.CLEAN_SHEET_ADJ;
    r -= SIM.CONCEDE_PEN * ctx.goalsConceded;
  }

  r += positionalPerf(ctx);
  r += ctx.jitter;
  return round1(clamp(r, 1, 10));
}

/** Rewards doing your job vs the opposition strength, giving non-scorers a spread. */
function positionalPerf(ctx: RatingContext): number {
  switch (ctx.player.position) {
    case 'GK':
    case 'DEF':
      return (0.4 * (ctx.ownDef - ctx.oppAtk)) / 50;
    case 'MID':
      return (0.3 * (ctx.ownMid - ctx.oppMid)) / 50;
    case 'FWD':
      return (0.3 * (ctx.ownAtk - ctx.oppDef)) / 50;
  }
}
