import { MARKET } from '../config';
import { generateWorld } from '../content';
import { createGame } from '../season';
import type { GameState, Player } from '../types';
import {
  buyPlayer,
  clubBudget,
  clubSquadValue,
  findBuyer,
  initialBudget,
  playerValue,
  sellPlayer,
} from '../transfers';
import { toggleTraining } from '../world';

function freshTakeover(seed = 2026): GameState {
  const w = generateWorld(seed);
  const leagueId = 'L0';
  const takeoverClubId = w.leagues[leagueId].clubIds[0];
  return createGame(w, { leagueId, mode: 'takeover', takeoverClubId });
}

function makeMid(overall: number, age: number, potential = overall): Player {
  return {
    id: 'X',
    clubId: 'C',
    name: 'Test Player',
    firstName: 'Test',
    lastName: 'Player',
    nationality: 'Testland',
    age,
    position: 'MID',
    attrs: { attacking: overall, defending: overall, midfield: overall },
    potential,
    form: 0,
    growthXp: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonApps: 0,
    seasonCleanSheets: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerApps: 0,
    careerCleanSheets: 0,
    peakValue: 0,
  };
}

/** First player at another club, owned by neither the user nor an empty club. */
function aTargetPlayer(s: GameState): Player {
  return Object.values(s.world.players).find((p) => p.clubId !== s.managedClubId)!;
}

describe('playerValue', () => {
  it('is positive and monotonic in overall at a fixed age', () => {
    const low = playerValue(makeMid(60, 26));
    const high = playerValue(makeMid(80, 26));
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it('rewards unrealised potential', () => {
    const plain = playerValue(makeMid(70, 22, 70));
    const wonderkid = playerValue(makeMid(70, 22, 88));
    expect(wonderkid).toBeGreaterThan(plain);
  });
});

describe('clubSquadValue', () => {
  it('equals the summed market value of the club roster', () => {
    const s = freshTakeover();
    const clubId = s.managedClubId;
    const manual = s.world.clubs[clubId].playerIds.reduce(
      (sum, id) => sum + playerValue(s.world.players[id]),
      0,
    );
    expect(clubSquadValue(s.world, clubId)).toBe(manual);
    expect(clubSquadValue(s.world, clubId)).toBeGreaterThan(0);
  });
});

describe('initialBudget', () => {
  it('is monotonic in reputation and respects the floor', () => {
    expect(initialBudget(45)).toBeGreaterThanOrEqual(MARKET.BUDGET_FLOOR);
    expect(initialBudget(65)).toBeGreaterThan(initialBudget(45));
    expect(initialBudget(85)).toBeGreaterThan(initialBudget(65));
  });
});

describe('buyPlayer', () => {
  it('moves ownership, adjusts both budgets, and grows the squad', () => {
    const s = freshTakeover();
    s.world.clubs[s.managedClubId].budget = 1_000_000; // ensure affordability
    const target = aTargetPlayer(s);
    const sellerId = target.clubId;
    const userBudget0 = clubBudget(s.world, s.managedClubId);
    const sellerBudget0 = clubBudget(s.world, sellerId);
    const userSize0 = s.world.clubs[s.managedClubId].playerIds.length;
    const sellerSize0 = s.world.clubs[sellerId].playerIds.length;

    const res = buyPlayer(s, target.id);

    expect(res.ok).toBe(true);
    const fee = res.fee!;
    expect(s.world.players[target.id].clubId).toBe(s.managedClubId);
    expect(s.world.clubs[s.managedClubId].playerIds).toContain(target.id);
    expect(s.world.clubs[sellerId].playerIds).not.toContain(target.id);
    expect(clubBudget(s.world, s.managedClubId)).toBe(userBudget0 - fee);
    expect(clubBudget(s.world, sellerId)).toBe(sellerBudget0 + fee);
    expect(s.world.clubs[s.managedClubId].playerIds.length).toBe(userSize0 + 1);
    expect(s.world.clubs[sellerId].playerIds.length).toBe(sellerSize0 - 1);
  });

  it('rejects a purchase the club cannot afford', () => {
    const s = freshTakeover();
    s.world.clubs[s.managedClubId].budget = 0;
    const res = buyPlayer(s, aTargetPlayer(s).id);
    expect(res.ok).toBe(false);
    expect(res.reason).toBeDefined();
  });
});

describe('sellPlayer', () => {
  it('removes the player from the lineup, moves him, and credits proceeds', () => {
    const s = freshTakeover();
    const playerId = s.squad.startingXI[5];
    const userBudget0 = clubBudget(s.world, s.managedClubId);

    const res = sellPlayer(s, playerId);

    expect(res.ok).toBe(true);
    const buyerId = res.otherClubId!;
    expect(s.squad.startingXI).not.toContain(playerId);
    expect(s.squad.bench).not.toContain(playerId);
    expect(s.world.players[playerId].clubId).toBe(buyerId);
    expect(s.world.clubs[buyerId].playerIds).toContain(playerId);
    expect(clubBudget(s.world, s.managedClubId)).toBe(userBudget0 + res.fee!);
  });

  it('keeps the XI at 11 by promoting a same-position replacement into the freed slot', () => {
    const s = freshTakeover();
    const slot = 5;
    const soldId = s.squad.startingXI[slot];
    const soldPos = s.world.players[soldId].position;

    const res = sellPlayer(s, soldId);

    expect(res.ok).toBe(true);
    expect(s.squad.startingXI).toHaveLength(11);
    expect(s.squad.startingXI).not.toContain(soldId);
    const replacementId = s.squad.startingXI[slot];
    // a different, owned player now occupies the same formation slot...
    expect(replacementId).not.toBe(soldId);
    expect(s.world.clubs[s.managedClubId].playerIds).toContain(replacementId);
    // ...of the same position, and he is no longer on the bench.
    expect(s.world.players[replacementId].position).toBe(soldPos);
    expect(s.squad.bench).not.toContain(replacementId);
  });

  it('clears any role held by the sold player', () => {
    const s = freshTakeover();
    const captainId = s.squad.roles.captainId!;
    const res = sellPlayer(s, captainId);
    expect(res.ok).toBe(true);
    expect(s.squad.roles.captainId).toBeUndefined();
  });

  it('frees the training slot held by the sold player', () => {
    const s = freshTakeover();
    const playerId = s.squad.startingXI[5];
    s.squad = toggleTraining(s.squad, playerId);
    expect(s.squad.trainingIds).toContain(playerId);

    const res = sellPlayer(s, playerId);
    expect(res.ok).toBe(true);
    expect(s.squad.trainingIds ?? []).not.toContain(playerId);
  });

  it('refuses to sell below the minimum squad size', () => {
    const s = freshTakeover();
    const club = s.world.clubs[s.managedClubId];
    club.playerIds = club.playerIds.slice(0, MARKET.MIN_SQUAD); // trim to the floor
    const res = sellPlayer(s, club.playerIds[0]);
    expect(res.ok).toBe(false);
  });

  it('refuses to sell a player the user does not own', () => {
    const s = freshTakeover();
    const res = sellPlayer(s, aTargetPlayer(s).id);
    expect(res.ok).toBe(false);
  });
});

describe('findBuyer', () => {
  it('finds an interested club for a sellable player', () => {
    const s = freshTakeover();
    const player = s.world.players[s.squad.startingXI[0]];
    const buyer = findBuyer(s.world, player, s.managedClubId);
    expect(buyer).toBeDefined();
    expect(buyer).not.toBe(s.managedClubId);
  });
});

describe('transfer determinism', () => {
  it('produces identical worlds for the same seed and buy sequence', () => {
    const run = () => {
      const s = freshTakeover(99);
      s.world.clubs[s.managedClubId].budget = 1_000_000;
      const target = aTargetPlayer(s);
      buyPlayer(s, target.id);
      return JSON.stringify(s.world);
    };
    expect(run()).toEqual(run());
  });
});
