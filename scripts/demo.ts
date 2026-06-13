/**
 * Manual sanity / balance tool (not a test). Run with: npm run demo
 * Generates a world, plays a full season, and prints a sample XI, the user's
 * first results, and the final table so you can eyeball the simulation's feel.
 */
import { overall } from '../src/engine/attrs';
import { generateWorld } from '../src/engine/content';
import { createGame, isSeasonComplete, leagueTable, playMatchday } from '../src/engine/season';

const seed = Number(process.argv[2] ?? 2026);
const w = generateWorld(seed);
const leagueId = 'L0';
const league = w.leagues[leagueId];
console.log(`Seed ${seed} — League: ${league.name} — ${league.clubIds.length} clubs`);

const s = createGame(w, { leagueId, mode: 'takeover', takeoverClubId: league.clubIds[0] });
const club = w.clubs[s.managedClubId];
console.log(`Managing: ${club.name} (${club.shortName}) rep ${club.reputation}\n`);

console.log('Starting XI:');
for (const id of s.squad.startingXI) {
  const p = w.players[id];
  console.log(`  ${p.position.padEnd(3)} ${p.name.padEnd(20)} OVR ${overall(p)}  age ${p.age}`);
}

console.log(`\nFirst 5 results for ${club.shortName}:`);
for (let i = 0; i < 5; i++) {
  const { userResult } = playMatchday(s);
  if (!userResult) continue;
  const h = w.clubs[userResult.homeClubId].shortName;
  const a = w.clubs[userResult.awayClubId].shortName;
  const scorers = userResult.events.map((e) => `${w.players[e.scorerId].lastName} ${e.minute}'`).join(', ');
  console.log(`  ${h} ${userResult.homeGoals}-${userResult.awayGoals} ${a}    ${scorers}`);
}

let guard = 0;
while (!isSeasonComplete(s) && guard++ < 200) playMatchday(s);

console.log('\nFinal table:');
leagueTable(s).forEach((r, i) => {
  const c = w.clubs[r.clubId];
  const you = r.clubId === s.managedClubId ? ' <-- you' : '';
  console.log(
    `  ${String(i + 1).padStart(2)}. ${c.shortName.padEnd(4)} P${r.played} W${r.won} D${r.drawn} L${r.lost}  ${r.gf}-${r.ga} (${r.gd >= 0 ? '+' : ''}${r.gd})  ${r.points}pts${you}`,
  );
});
