import { generateWorld } from '../content';
import { clubRecords, leagueRecords } from '../records';
import { advanceSeason, createGame, isSeasonComplete, playMatchday } from '../season';
import { transferPlayer } from '../transfers';
import type { GameState } from '../types';

function freshTakeover(seed = 2026): GameState {
  const w = generateWorld(seed);
  const leagueId = 'L0';
  const takeoverClubId = w.leagues[leagueId].clubIds[0];
  return createGame(w, { leagueId, mode: 'takeover', takeoverClubId });
}

function playFullSeason(s: GameState) {
  let guard = 0;
  while (!isSeasonComplete(s) && guard++ < 100) playMatchday(s);
}

describe('leagueRecords', () => {
  it('returns empty tables before any match is played', () => {
    const s = freshTakeover();
    const r = leagueRecords(s);
    expect(r.topScorers).toHaveLength(0);
    expect(r.topAssisters).toHaveLength(0);
    expect(r.topGoalkeepers).toHaveLength(0);
    expect(r.mostCards).toHaveLength(0);
  });

  it('ranks scorers, assisters and goalkeepers after a season', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const r = leagueRecords(s, 5);

    expect(r.topScorers.length).toBeGreaterThan(0);
    expect(r.topScorers.length).toBeLessThanOrEqual(5);
    expect(r.topAssisters.length).toBeGreaterThan(0);
    expect(r.topGoalkeepers.length).toBeGreaterThan(0);

    // sorted descending by the relevant stat
    for (let i = 1; i < r.topScorers.length; i++) {
      expect(r.topScorers[i - 1].value).toBeGreaterThanOrEqual(r.topScorers[i].value);
    }
    for (let i = 1; i < r.topGoalkeepers.length; i++) {
      expect(r.topGoalkeepers[i - 1].value).toBeGreaterThanOrEqual(r.topGoalkeepers[i].value);
    }

    // goalkeeper table only contains GKs, with a positive clean-sheet count
    for (const e of r.topGoalkeepers) {
      expect(e.player.position).toBe('GK');
      expect(e.value).toBeGreaterThan(0);
    }

    // each entry carries its club and a sane market value
    for (const e of r.topScorers) {
      expect(e.club).toBeDefined();
      expect(e.marketValue).toBeGreaterThan(0);
      expect(e.value).toBe(e.player.seasonGoals);
    }

    // most-carded table: sorted by total cards, with the yellow/red split
    expect(r.mostCards.length).toBeGreaterThan(0);
    for (let i = 1; i < r.mostCards.length; i++) {
      expect(r.mostCards[i - 1].value).toBeGreaterThanOrEqual(r.mostCards[i].value);
    }
    for (const e of r.mostCards) {
      expect(e.value).toBeGreaterThan(0);
      expect(e.value).toBe((e.yellow ?? 0) + (e.red ?? 0));
      expect(e.value).toBe((e.player.seasonYellowCards ?? 0) + (e.player.seasonRedCards ?? 0));
    }
  });

  it('only includes players from the managed league', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const leagueClubs = new Set(s.world.leagues[s.season.leagueId].clubIds);
    const r = leagueRecords(s);
    for (const group of [r.topScorers, r.topAssisters, r.topGoalkeepers]) {
      for (const e of group) {
        expect(leagueClubs.has(e.player.clubId)).toBe(true);
      }
    }
  });

  it('credits clean sheets that reset at season end', () => {
    const s = freshTakeover();
    playFullSeason(s);
    const totalCS = Object.values(s.world.players).reduce(
      (sum, p) => sum + (p.seasonCleanSheets ?? 0),
      0,
    );
    expect(totalCS).toBeGreaterThan(0);
  });
});

describe('clubRecords', () => {
  it('is empty before any match but reports a current squad value', () => {
    const s = freshTakeover();
    const c = clubRecords(s);
    expect(c.topScorers).toHaveLength(0);
    expect(c.topAssisters).toHaveLength(0);
    expect(c.mostCards).toHaveLength(0);
    expect(c.trophies).toBe(0);
    expect(c.seasonsPlayed).toBe(0);
    expect(c.bestFinish).toBe(0);
    expect(c.squadValue).toBeGreaterThan(0);
    expect(c.peakSquadValue).toBeGreaterThanOrEqual(c.squadValue);
  });

  it('ranks the club all-time scorers/assisters descending', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    const c = clubRecords(s, s.managedClubId, 5);
    expect(c.topScorers.length).toBeGreaterThan(0);
    expect(c.topScorers.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < c.topScorers.length; i++) {
      expect(c.topScorers[i - 1].value).toBeGreaterThanOrEqual(c.topScorers[i].value);
    }
    for (let i = 1; i < c.topAssisters.length; i++) {
      expect(c.topAssisters[i - 1].value).toBeGreaterThanOrEqual(c.topAssisters[i].value);
    }
  });

  it('keeps a sold player on the club all-time list', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    const before = clubRecords(s, s.managedClubId, 20);
    const sold = before.topScorers[0];
    expect(sold).toBeDefined();

    const otherClub = s.world.leagues[s.season.leagueId].clubIds.find((c) => c !== s.managedClubId)!;
    transferPlayer(s.world, sold.player.id, otherClub);

    const after = clubRecords(s, s.managedClubId, 20);
    const stillThere = after.topScorers.find((e) => e.player.id === sold.player.id);
    expect(stillThere).toBeDefined();
    expect(stillThere!.value).toBe(sold.value);
    // the entry's club now reflects where the player currently plays
    expect(stillThere!.club.id).toBe(otherClub);
  });

  it('counts league titles as trophies and tracks best finish', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    advanceSeason(s);
    const champion = s.history[0].championClubId;
    const c = clubRecords(s, champion);
    expect(c.trophies).toBe(1);
    expect(c.seasonsPlayed).toBe(1);
    const userStats = clubRecords(s, s.managedClubId);
    expect(userStats.bestFinish).toBe(s.history[0].userPosition);
  });

  it('records all-time contributions for AI clubs too, not just the managed one', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    const aiClubs = s.world.leagues[s.season.leagueId].clubIds.filter((c) => c !== s.managedClubId);
    const withScorers = aiClubs.filter((c) => clubRecords(s, c).topScorers.length > 0);
    expect(withScorers.length).toBeGreaterThan(0);
  });

  it('attributes each goal to exactly one club (cross-club integrity)', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    let ledgerGoals = 0;
    for (const club of Object.values(s.world.clubs)) {
      for (const c of Object.values(club.playerContributions ?? {})) ledgerGoals += c.goals;
    }
    const careerGoals = Object.values(s.world.players).reduce((sum, p) => sum + (p.careerGoals ?? 0), 0);
    expect(ledgerGoals).toBeGreaterThan(0);
    expect(ledgerGoals).toBe(careerGoals);
  });

  it('ranks the club all-time most-carded players with a yellow/red split', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    const c = clubRecords(s, s.managedClubId, 5);
    expect(c.mostCards.length).toBeGreaterThan(0);
    for (let i = 1; i < c.mostCards.length; i++) {
      expect(c.mostCards[i - 1].value).toBeGreaterThanOrEqual(c.mostCards[i].value);
    }
    for (const e of c.mostCards) {
      expect(e.value).toBe((e.yellow ?? 0) + (e.red ?? 0));
      expect(e.value).toBeGreaterThan(0);
    }
  });

  it('attributes every card to exactly one club (discipline ledger integrity)', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    let ledgerY = 0;
    let ledgerR = 0;
    for (const club of Object.values(s.world.clubs)) {
      for (const c of Object.values(club.playerContributions ?? {})) {
        ledgerY += c.yellow ?? 0;
        ledgerR += c.red ?? 0;
      }
    }
    const careerY = Object.values(s.world.players).reduce((sum, p) => sum + (p.careerYellowCards ?? 0), 0);
    const careerR = Object.values(s.world.players).reduce((sum, p) => sum + (p.careerRedCards ?? 0), 0);
    expect(ledgerY).toBeGreaterThan(0);
    expect(ledgerY).toBe(careerY); // every booking logged to exactly one club
    expect(ledgerR).toBe(careerR); // every sending-off logged to exactly one club
  });

  it('reports a best finish only for the managed club', () => {
    const s = freshTakeover(6);
    playFullSeason(s);
    advanceSeason(s);
    const other = s.world.leagues[s.season.leagueId].clubIds.find((c) => c !== s.managedClubId)!;
    expect(clubRecords(s, s.managedClubId).bestFinish).toBe(s.history[0].userPosition);
    expect(clubRecords(s, other).bestFinish).toBe(0);
  });
});
