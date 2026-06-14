import { makeRng } from '../rng';
import { simulateMatch, type SimTeam } from '../sim';
import type { SquadRoles } from '../types';
import { makeTeam } from './factory';

function play(seed: number, levelH = 70, levelA = 70, rolesH: SquadRoles = {}, homeAdv = false) {
  const home: SimTeam = makeTeam('H', levelH, rolesH, homeAdv);
  const away: SimTeam = makeTeam('A', levelA, {}, false);
  return simulateMatch({ home, away, rng: makeRng(seed) });
}

/** Both teams have a 7-man bench (~6 levels below the XI), so subs are made. */
function playWithBench(seed: number) {
  const home: SimTeam = makeTeam('H', 72, {}, false, 66);
  const away: SimTeam = makeTeam('A', 72, {}, false, 66);
  return simulateMatch({ home, away, rng: makeRng(seed) });
}

describe('match simulation', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(play(2024))).toEqual(JSON.stringify(play(2024)));
  });

  it('rates every starter on a 1..10 scale', () => {
    const r = play(1);
    const ids = Object.keys(r.ratings);
    expect(ids.length).toBe(22);
    for (const id of ids) {
      expect(r.ratings[id].rating).toBeGreaterThanOrEqual(1);
      expect(r.ratings[id].rating).toBeLessThanOrEqual(10);
    }
  });

  it('produces a believable scoreline distribution at parity', () => {
    const N = 8000;
    const totals: number[] = [];
    let totalGoals = 0;
    let big = 0;
    for (let s = 0; s < N; s++) {
      const r = play(s, 70, 70);
      const t = r.homeGoals + r.awayGoals;
      totals.push(t);
      totalGoals += t;
      if (t >= 6) big++;
    }
    const perTeam = totalGoals / (N * 2);
    // realistic football: ~1.1-1.5 goals per team per match
    expect(perTeam).toBeGreaterThan(1.1);
    expect(perTeam).toBeLessThan(1.5);

    const counts: Record<number, number> = {};
    for (const t of totals) counts[t] = (counts[t] ?? 0) + 1;
    let mode = 0;
    let modeCount = -1;
    for (const k of Object.keys(counts)) {
      if (counts[+k] > modeCount) {
        modeCount = counts[+k];
        mode = +k;
      }
    }
    expect([1, 2, 3]).toContain(mode);
    // 6+ goal games are uncommon (~1 in 20 in real football), not absent
    expect(big / N).toBeLessThan(0.07);
  });

  it('a much stronger team outscores a weaker one', () => {
    const N = 4000;
    let strong = 0;
    let weak = 0;
    for (let s = 0; s < N; s++) {
      const r = play(s, 82, 52);
      strong += r.homeGoals;
      weak += r.awayGoals;
    }
    expect(strong / N).toBeGreaterThan(weak / N + 0.6);
  });

  it('home advantage helps the home team on aggregate', () => {
    const N = 4000;
    let withAdv = 0;
    let without = 0;
    for (let s = 0; s < N; s++) {
      withAdv += play(s, 70, 70, {}, true).homeGoals;
      without += play(s, 70, 70, {}, false).homeGoals;
    }
    expect(withAdv).toBeGreaterThan(without);
  });

  it('forwards score far more than defenders', () => {
    let fwd = 0;
    let def = 0;
    for (let s = 0; s < 3000; s++) {
      const r = play(s, 70, 70);
      for (const e of r.events) {
        if (e.scorerId.includes('FWD')) fwd++;
        else if (e.scorerId.includes('DEF')) def++;
      }
    }
    expect(fwd).toBeGreaterThan(def * 3);
  });

  it('shows cards, with reds far rarer than yellows', () => {
    const N = 5000;
    let yellow = 0;
    let red = 0;
    let secondYellowReds = 0;
    for (let s = 0; s < N; s++) {
      for (const c of play(s).cards) {
        if (c.type === 'yellow') yellow++;
        else {
          red++;
          if (c.secondYellow) secondYellowReds++;
        }
        expect(c.minute).toBeGreaterThanOrEqual(1);
        expect(c.minute).toBeLessThanOrEqual(90);
      }
    }
    // realistic football: a few yellows a game, the odd red
    const yellowPerMatch = yellow / N;
    expect(yellowPerMatch).toBeGreaterThan(1.5);
    expect(yellowPerMatch).toBeLessThan(6);
    expect(red).toBeGreaterThan(0);
    expect(red).toBeLessThan(yellow * 0.1); // reds are an order of magnitude rarer
    expect(secondYellowReds).toBeGreaterThan(0); // some reds come from two bookings
  });

  it('a sending-off weakens the carded team and lifts the opponent', () => {
    let downGoals = 0; // goals scored by the team that went a man down
    let oppGoals = 0; // goals scored by the side that stayed at eleven
    let n = 0;
    for (let s = 0; s < 20000; s++) {
      const r = play(s); // level 70 both, no home advantage -> symmetric at parity
      const homeRed = r.cards.some((c) => c.type === 'red' && c.clubId === 'H');
      const awayRed = r.cards.some((c) => c.type === 'red' && c.clubId === 'A');
      if (homeRed === awayRed) continue; // need exactly one side reduced
      if (homeRed) {
        downGoals += r.homeGoals;
        oppGoals += r.awayGoals;
      } else {
        downGoals += r.awayGoals;
        oppGoals += r.homeGoals;
      }
      n++;
    }
    expect(n).toBeGreaterThan(200);
    // the eleven-man side clearly outscores the team playing with ten
    expect(oppGoals / n).toBeGreaterThan(downGoals / n + 0.5);
  });

  it('never books or sends off the same player twice in one match', () => {
    for (let s = 0; s < 1500; s++) {
      const r = play(s);
      const yellows = new Set<string>();
      const reds = new Set<string>();
      for (const c of r.cards) {
        if (c.type === 'red') {
          expect(reds.has(c.playerId)).toBe(false); // at most one sending-off each
          reds.add(c.playerId);
        } else {
          expect(yellows.has(c.playerId)).toBe(false); // a 2nd booking becomes a red
          yellows.add(c.playerId);
        }
      }
    }
  });

  it('books defenders and midfielders far more than goalkeepers', () => {
    let gk = 0;
    let defMid = 0;
    for (let s = 0; s < 3000; s++) {
      for (const c of play(s).cards) {
        if (c.playerId.includes('_GK')) gk++;
        else if (c.playerId.includes('_DEF') || c.playerId.includes('_MID')) defMid++;
      }
    }
    expect(defMid).toBeGreaterThan(gk * 10);
  });

  it('injures players occasionally, with a bounded recovery time', () => {
    const N = 6000;
    let injuries = 0;
    for (let s = 0; s < N; s++) {
      for (const inj of play(s).injuries) {
        injuries++;
        expect(inj.matchesOut).toBeGreaterThanOrEqual(1);
        expect(inj.matchesOut).toBeLessThanOrEqual(10);
        expect(inj.minute).toBeGreaterThanOrEqual(1);
        expect(inj.minute).toBeLessThanOrEqual(90);
      }
    }
    // they happen, but are rare (well under one per team per match)
    expect(injuries).toBeGreaterThan(0);
    expect(injuries / N).toBeLessThan(1);
  });

  it('makes substitutions from the bench, averaging close to four per team', () => {
    const N = 6000;
    let subs = 0;
    for (let s = 0; s < N; s++) {
      for (const sub of playWithBench(s).subs) {
        if (sub.clubId !== 'H') continue;
        subs++;
        expect(sub.minute).toBeGreaterThanOrEqual(1);
        expect(sub.minute).toBeLessThanOrEqual(90);
        expect(sub.onPlayerId).not.toBe(sub.offPlayerId);
      }
    }
    const perTeam = subs / N;
    expect(perTeam).toBeGreaterThan(3.5);
    expect(perTeam).toBeLessThan(4.4);
  });

  it('makes no substitutions when there is no bench', () => {
    for (let s = 0; s < 300; s++) {
      expect(play(s).subs.length).toBe(0);
    }
  });

  it('lets substitutes score, but as a minority of goals', () => {
    let subGoals = 0;
    let total = 0;
    for (let s = 0; s < 8000; s++) {
      const r = playWithBench(s);
      const onIds = new Set(r.subs.map((x) => x.onPlayerId));
      for (const e of r.events) {
        total++;
        if (onIds.has(e.scorerId)) subGoals++;
      }
    }
    expect(subGoals).toBeGreaterThan(0); // subs do find the net
    expect(subGoals / total).toBeLessThan(0.25); // but most goals come from starters
  });

  it('docks sent-off players, dragging their average rating well below the rest', () => {
    let redSum = 0;
    let redN = 0;
    let otherSum = 0;
    let otherN = 0;
    for (let s = 0; s < 8000; s++) {
      const r = playWithBench(s);
      const reds = new Set(r.cards.filter((c) => c.type === 'red').map((c) => c.playerId));
      for (const id of Object.keys(r.ratings)) {
        if (reds.has(id)) {
          redSum += r.ratings[id].rating;
          redN++;
        } else {
          otherSum += r.ratings[id].rating;
          otherN++;
        }
      }
    }
    expect(redN).toBeGreaterThan(50);
    expect(redSum / redN).toBeLessThan(otherSum / otherN - 2); // clearly dragged down
  });

  it('the designated penalty taker takes every penalty while he is on the pitch', () => {
    const roles: SquadRoles = { penaltyTakerId: 'H_DEF0' };
    let pens = 0;
    let byTaker = 0;
    for (let s = 0; s < 3000; s++) {
      const r = simulateMatch({ home: makeTeam('H', 70, roles), away: makeTeam('A', 70), rng: makeRng(s) });
      // no bench => the taker only leaves the pitch via a sending-off or an injury;
      // count matches where he played the full 90, where he should take every penalty
      const left = r.cards.some((c) => c.clubId === 'H' && c.playerId === 'H_DEF0' && c.type === 'red')
        || r.injuries.some((i) => i.clubId === 'H' && i.playerId === 'H_DEF0');
      if (left) continue;
      for (const e of r.events) {
        if (e.type === 'penalty' && e.clubId === 'H') {
          pens++;
          if (e.scorerId === 'H_DEF0') byTaker++;
        }
      }
    }
    expect(pens).toBeGreaterThan(20);
    expect(byTaker).toBe(pens);
  });

  it('hands set-piece duties (penalties and free kicks) to the substitute once the taker is subbed off', () => {
    const roles: SquadRoles = { penaltyTakerId: 'H_FWD0', freeKickTakerId: 'H_FWD0' };
    let afterSub = 0; // set pieces awarded after the taker was replaced
    let byReplacement = 0;
    let byOriginal = 0;
    for (let s = 0; s < 9000; s++) {
      const home = makeTeam('H', 72, roles, false, 66);
      const away = makeTeam('A', 72, {}, false, 66);
      const r = simulateMatch({ home, away, rng: makeRng(s) });
      // isolate the substitution chain: skip matches with a home sending-off
      if (r.cards.some((c) => c.clubId === 'H' && c.type === 'red')) continue;
      const offToSub = new Map(r.subs.filter((x) => x.clubId === 'H').map((x) => [x.offPlayerId, x] as const));
      for (const e of r.events) {
        if ((e.type !== 'penalty' && e.type !== 'free_kick') || e.clubId !== 'H') continue;
        // follow the sub chain from the taker to whoever holds the role at this minute
        let id = 'H_FWD0';
        let replaced = false;
        for (let g = 0; g < 12; g++) {
          const sub = offToSub.get(id);
          if (sub && e.minute >= sub.minute) {
            id = sub.onPlayerId;
            replaced = true;
          } else break;
        }
        if (!replaced) continue; // taker still on for this penalty (covered by the previous test)
        afterSub++;
        if (e.scorerId === id) byReplacement++;
        if (e.scorerId === 'H_FWD0') byOriginal++;
      }
    }
    expect(afterSub).toBeGreaterThan(20); // the inheritance path is actually exercised
    expect(byOriginal).toBe(0); // the subbed-off taker never takes them
    expect(byReplacement).toBe(afterSub); // his replacement takes them all
  });
});
