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
import { generateWorld } from '../src/engine/content';
import { advanceSeason, createGame, isSeasonComplete, playMatchday } from '../src/engine/season';

const seasons = Math.max(1, Number(process.argv[2] ?? 10));
const seed = Number(process.argv[3] ?? 2026);

const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const ms = (n: number) => `${n.toFixed(1)}ms`;
// Available only with --expose-gc; lets us measure retained (not just allocated) heap.
const gc: (() => void) | undefined = (globalThis as { gc?: () => void }).gc;
const heapNow = () => {
  gc?.();
  return process.memoryUsage().heapUsed;
};

function playToEnd(state: ReturnType<typeof createGame>) {
  let guard = 0;
  let fixtures = 0;
  while (!isSeasonComplete(state) && guard++ < 200) {
    const { userResult } = playMatchday(state);
    if (userResult) fixtures++;
  }
  return fixtures;
}

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
