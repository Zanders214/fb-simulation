/**
 * Determinism & purity guard — the JS analog of an audio plugin's real-time
 * sanitizer. RTSan catches a malloc/lock sneaking onto the audio thread; this
 * catches the equivalent "surprise" in a pure sim engine: accidental
 * nondeterminism from the wall clock (Date.now), the global RNG (Math.random),
 * or object-key / Set / Map iteration order leaking into outcomes.
 *
 * Three assertions, all driving only the public engine API:
 *   1. self-consistency — two fresh runs of one seed agree (zero-maintenance net).
 *   2. golden digest — outcomes match a committed value (cross-commit behaviour lock).
 *   3. runtime purity — a full season never touches Math.random or the clock.
 *
 * The engine promises this (rng.ts: "we never touch the global Math.random or
 * the clock"); these turn that convention into an enforced invariant.
 */
import { generateWorld } from '../content';
import { advanceSeason, createGame, isSeasonComplete, playMatchday } from '../season';
import { computeTable } from '../standings';

const SEED = 20260625;
// Two seasons keeps the suite quick while still exercising one full
// advanceSeason rollover (promotion/relegation, fixture regeneration, ageing).
const SEASONS = 2;

/**
 * FNV-1a over a string (same mixing family as rng.ts's hashSeed — no new dep).
 * Returns an 8-hex-digit digest.
 */
function digestOf(parts: string[]): string {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Play SEASONS seasons from a fixed seed and fold the OUTCOMES — not the whole
 * GameState — into a stable digest. We list every field in a fixed order and
 * never JSON.stringify a whole object, so the digest itself can't depend on
 * key-insertion order (one of the very nondeterminism classes we're guarding).
 */
function runDigest(seed: number): string {
  const world = generateWorld(seed);
  const game = createGame(world, {
    leagueId: 'L1',
    mode: 'takeover',
    takeoverClubId: world.leagues.L1.clubIds[0],
  });

  const parts: string[] = [];
  for (let s = 0; s < SEASONS; s++) {
    // Play the season to completion, capturing the user's scoreline each matchday.
    let guard = 0;
    while (!isSeasonComplete(game) && guard++ < 200) {
      const { userResult: u } = playMatchday(game);
      if (u) parts.push(`R:${u.homeClubId}:${u.awayClubId}:${u.homeGoals}:${u.awayGoals}`);
    }
    // Final table of the league just played (computeTable sorts deterministically).
    // Must be read BEFORE advanceSeason regenerates next season's fixtures.
    const clubIds = game.world.leagues[game.season.leagueId].clubIds;
    for (const r of computeTable(game.season.fixtures, clubIds)) {
      parts.push(`T:${r.clubId}:${r.played}:${r.won}:${r.drawn}:${r.lost}:${r.gf}:${r.ga}:${r.gd}:${r.points}`);
    }
    if (s < SEASONS - 1) {
      advanceSeason(game);
      const h = game.history[game.history.length - 1];
      parts.push(`H:${h.championClubId}:${h.userPosition}:${h.movement ?? ''}:${h.tier ?? ''}`);
    }
  }
  return digestOf(parts);
}

// Cross-commit behaviour lock. Regenerate intentionally: on a mismatch the test
// logs the new digest — paste it here in the same commit that changed behaviour,
// so the bump shows up in review and git blame.
const EXPECTED = '98d88527';

describe('engine determinism', () => {
  it('two fresh runs of the same seed agree (intra-process nondeterminism guard)', () => {
    expect(runDigest(SEED)).toEqual(runDigest(SEED));
  });

  it('matches the committed golden digest (cross-commit behaviour lock)', () => {
    const actual = runDigest(SEED);
    if (actual !== EXPECTED) {
      console.log(`[determinism] digest changed. New golden: ${actual}`);
    }
    expect(actual).toEqual(EXPECTED);
  });

  it('plays a full season without touching Math.random or the clock', () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    Math.random = () => {
      throw new Error('engine called the global Math.random — use the injected Rng (rng.ts)');
    };
    Date.now = () => {
      throw new Error('engine read the clock via Date.now — the engine must be clock-free');
    };
    try {
      const world = generateWorld(SEED);
      const game = createGame(world, {
        leagueId: 'L1',
        mode: 'takeover',
        takeoverClubId: world.leagues.L1.clubIds[0],
      });
      let guard = 0;
      while (!isSeasonComplete(game) && guard++ < 200) playMatchday(game);
      advanceSeason(game);
    } finally {
      Math.random = realRandom;
      Date.now = realNow;
    }
  });
});
