/**
 * Engine performance benchmark (not a test). Run with: npm run bench [seasons] [seed]
 *
 * The simulation engine (src/engine) is the real CPU/memory hotspot of this app
 * — it generates a world and plays thousands of fixtures while allocating many
 * short-lived objects. Static analysers (SonarCloud, ESLint) can't see that, so
 * this harness measures it: wall-clock per season and heap growth across a run.
 *
 * Use it to spot regressions (a change that makes a season slower or leakier)
 * and to find allocation hotspots before they hit a real device. For accurate
 * peak-memory numbers, expose GC:  node --expose-gc ... or  npm run bench:gc
 *
 * It only READS the engine's public API (the same calls the app and demo make),
 * so it never changes simulation behaviour.
 */
import { writeFileSync } from 'node:fs';
import { generateWorld } from '../src/engine/content';
import { advanceSeason, createGame, isSeasonComplete, playMatchday } from '../src/engine/season';

// Flag-tolerant arg parse: positional [seasons] [seed] in any order around an
// optional `--json`. Default UX (npm run bench) is unchanged; `--json` is purely
// additive — it also writes bench-results.json for the CI dashboard.
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const seasons = Math.max(1, Number(positional[0] ?? 10));
const seed = Number(positional[1] ?? 2026);
const emitJson = flags.has('--json');
const JSON_PATH = 'bench-results.json';

const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const ms = (n: number) => `${n.toFixed(1)}ms`;
// Available only with --expose-gc; lets us measure retained (not just allocated) heap.
const gc: (() => void) | undefined = (globalThis as { gc?: () => void }).gc;
const heapNow = () => {
  gc?.();
  return process.memoryUsage().heapUsed;
};

// Per-matchday timings across the whole run — a finer, still-aggregated proxy
// for the simulateMatch hot loop than the per-season figure. Median rejects
// GC-pause outliers. (The warmup season below is excluded.)
const matchdayMs: number[] = [];

function playToEnd(state: ReturnType<typeof createGame>) {
  let guard = 0;
  let fixtures = 0;
  while (!isSeasonComplete(state) && guard++ < 200) {
    const md0 = performance.now();
    const { userResult } = playMatchday(state);
    matchdayMs.push(performance.now() - md0);
    if (userResult) fixtures++;
  }
  return fixtures;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log(`Engine benchmark — ${seasons} season(s), seed ${seed}${gc ? ' (GC exposed)' : ''}\n`);

const worldStart = performance.now();
const heapBefore = heapNow();
const world = generateWorld(seed);
const game = createGame(world, {
  leagueId: 'L1',
  mode: 'takeover',
  takeoverClubId: world.leagues.L1.clubIds[0],
});
const setupMs = performance.now() - worldStart;

// Warmup: one throwaway season on a separate game so the JIT has tiered-up the
// hot path before timing. Deterministic, so it does identical work to the first
// real season — not counted in perSeasonMs/matchdayMs.
const warmGame = createGame(world, {
  leagueId: 'L1',
  mode: 'takeover',
  takeoverClubId: world.leagues.L1.clubIds[0],
});
for (let g = 0; !isSeasonComplete(warmGame) && g < 200; g++) playMatchday(warmGame);

const perSeasonMs: number[] = [];
let totalUserFixtures = 0;
let peakHeap = heapBefore;

for (let n = 0; n < seasons; n++) {
  const t0 = performance.now();
  totalUserFixtures += playToEnd(game);
  if (n < seasons - 1) advanceSeason(game); // roll over (pro/rel) for the next loop
  perSeasonMs.push(performance.now() - t0);
  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
}

const heapAfter = heapNow();
const total = perSeasonMs.reduce((a, b) => a + b, 0);
const avg = total / perSeasonMs.length;
const fastest = Math.min(...perSeasonMs);
const slowest = Math.max(...perSeasonMs);

console.log(`World gen + new game : ${ms(setupMs)}`);
console.log(`Seasons played       : ${seasons}  (${totalUserFixtures} user fixtures)`);
console.log(`Per season           : avg ${ms(avg)}  (min ${ms(fastest)}, max ${ms(slowest)})`);
console.log(`Total sim time       : ${ms(total)}`);
console.log(
  `Heap                 : ${mib(heapBefore)} → ${mib(heapAfter)} MiB ` +
    `(retained +${mib(heapAfter - heapBefore)}, peak ${mib(peakHeap)})${gc ? '' : '  — run npm run bench:gc for accurate retained/peak'}`,
);

// Machine-readable output for github-action-benchmark (customSmallerIsBetter:
// an array of { name, unit, value }). The `name` strings are permanent series
// keys on the dashboard — don't rename them once history accumulates.
if (emitJson) {
  const retainedMiBPerSeason = (heapAfter - heapBefore) / 1024 / 1024 / seasons;
  const metrics = [
    { name: 'world-gen + setup', unit: 'ms', value: Number(setupMs.toFixed(2)) },
    { name: 'per-season avg', unit: 'ms', value: Number(avg.toFixed(2)) },
    { name: 'per-matchday median', unit: 'ms', value: Number(median(matchdayMs).toFixed(3)) },
    { name: 'retained heap / season', unit: 'MiB', value: Number(retainedMiBPerSeason.toFixed(3)) },
  ];
  writeFileSync(JSON_PATH, JSON.stringify(metrics, null, 2) + '\n');
  console.log(`\nWrote ${metrics.length} metrics → ${JSON_PATH}`);
}
