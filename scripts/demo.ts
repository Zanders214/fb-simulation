/**
 * Manual sanity / balance tool (not a test). Run with: npm run demo
 * Generates a world, plays a full season, and prints a sample XI, the user's
 * first results, and the final table so you can eyeball the simulation's feel.
 */
import { overall } from '../src/engine/attrs';
import { generateWorld } from '../src/engine/content';
import { advanceSeason, createGame, isSeasonComplete, leagueTable, playMatchday } from '../src/engine/season';

const seed = Number(process.argv[2] ?? 2026);
const w = generateWorld(seed);
// Start in a middle tier so promotion/relegation is visible across seasons.
const leagueId = 'L1';
const league = w.leagues[leagueId];
console.log(`Seed ${seed} — League: ${league.name} (${league.country}, tier ${league.tier}) — ${league.clubIds.length} clubs`);

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
  const cards = userResult.cards.map((c) => `${c.type === 'yellow' ? '🟨' : '🟥'}${w.players[c.playerId].lastName}`).join(' ');
  const injuries = userResult.injuries.map((iv) => `🚑${w.players[iv.playerId].lastName}(${iv.matchesOut})`).join(' ');
  const myId = s.managedClubId;
  const subs = userResult.subs
    .filter((x) => x.clubId === myId)
    .map((x) => `🔁${w.players[x.onPlayerId].lastName} ${x.minute}'`)
    .join(' ');
  console.log(`  ${h} ${userResult.homeGoals}-${userResult.awayGoals} ${a}    ${scorers}${cards ? `   ${cards}` : ''}${injuries ? `   ${injuries}` : ''}${subs ? `   ${subs}` : ''}`);
}

function playToEnd() {
  let guard = 0;
  while (!isSeasonComplete(s) && guard++ < 200) playMatchday(s);
}

playToEnd();

// Discipline & injury tally across the whole season just played (every fixture).
let yellow = 0;
let red = 0;
let injuries = 0;
let subs = 0;
for (const f of s.season.fixtures) {
  if (!f.result) continue;
  for (const c of f.result.cards) {
    if (c.type === 'yellow') yellow++;
    else red++;
  }
  injuries += f.result.injuries.length;
  subs += f.result.subs.length;
}
const games = s.season.fixtures.filter((f) => f.result).length;
console.log(
  `\nSeason discipline: ${yellow} yellow, ${red} red over ${games} games ` +
    `(${(yellow / games).toFixed(2)} / ${(red / games).toFixed(2)} per game); ${injuries} injuries; ` +
    `${subs} subs (${(subs / (games * 2)).toFixed(2)} per team/game).`,
);

console.log('\nFinal table:');
leagueTable(s).forEach((r, i) => {
  const c = w.clubs[r.clubId];
  const you = r.clubId === s.managedClubId ? ' <-- you' : '';
  console.log(
    `  ${String(i + 1).padStart(2)}. ${c.shortName.padEnd(4)} P${r.played} W${r.won} D${r.drawn} L${r.lost}  ${r.gf}-${r.ga} (${r.gd >= 0 ? '+' : ''}${r.gd})  ${r.points}pts${you}`,
  );
});

function movementArrow(movement: string | undefined): string {
  if (movement === 'promoted') return '⬆ promoted';
  if (movement === 'relegated') return '⬇ relegated';
  return '— stayed';
}

console.log('\nPromotion / relegation over the next few seasons:');
for (let n = 0; n < 4; n++) {
  advanceSeason(s); // rolls over the season just played, applying pro/rel
  const h = s.history[s.history.length - 1];
  const played = w.leagues[h.leagueId ?? ''];
  console.log(
    `  Season ${h.season}: ${club.shortName} finished ${h.userPosition} in ${played?.name} → ${movementArrow(h.movement)}`,
  );
  playToEnd();
}
