import { TRAINING } from '../config';
import { generateWorld } from '../content';
import {
  autoPickSquad,
  isPlayableXI,
  removeFromSquad,
  setRole,
  swapPlayer,
  swapStarters,
  toggleTraining,
  validateXI,
} from '../world';

describe('squad helpers', () => {
  const w = generateWorld(321);
  const clubId = w.leagues['L0'].clubIds[0];

  it('auto-picks a valid 4-4-2 with roles inside the XI', () => {
    const sq = autoPickSquad(w, clubId);
    expect(sq.startingXI.length).toBe(11);
    const xi = sq.startingXI.map((id) => w.players[id]);
    expect(xi.filter((p) => p.position === 'GK').length).toBe(1);
    expect(xi.filter((p) => p.position === 'DEF').length).toBe(4);
    expect(xi.filter((p) => p.position === 'MID').length).toBe(4);
    expect(xi.filter((p) => p.position === 'FWD').length).toBe(2);
    expect(isPlayableXI(w, sq, clubId)).toBe(true);
    expect(sq.roles.captainId).toBeDefined();
    expect(sq.startingXI).toContain(sq.roles.captainId);
    expect(sq.startingXI).toContain(sq.roles.penaltyTakerId);
    expect(sq.startingXI).toContain(sq.roles.freeKickTakerId);
  });

  it('leaves injured and suspended players out of an auto-picked XI', () => {
    const fw = generateWorld(321); // fresh world so we don't mutate the shared one
    const cid = fw.leagues['L0'].clubIds[0];
    const baseline = autoPickSquad(fw, cid);
    const injured = baseline.startingXI[1];
    const suspended = baseline.startingXI[2];
    fw.players[injured].injuredMatches = 3;
    fw.players[suspended].suspendedMatches = 1;

    const sq = autoPickSquad(fw, cid);
    expect(sq.startingXI).not.toContain(injured);
    expect(sq.startingXI).not.toContain(suspended);
    expect(sq.startingXI.length).toBe(11); // backfilled from the rest of the squad
    expect(sq.bench).not.toContain(injured);
    expect(sq.bench).not.toContain(suspended);
  });

  it('warns (but stays playable) when a starter is injured', () => {
    const fw = generateWorld(321);
    const cid = fw.leagues['L0'].clubIds[0];
    const sq = autoPickSquad(fw, cid);
    fw.players[sq.startingXI[4]].injuredMatches = 2;
    const issues = validateXI(fw, sq, cid);
    expect(issues.some((i) => i.type === 'unavailable' && i.severity === 'warning')).toBe(true);
    expect(isPlayableXI(fw, sq, cid)).toBe(true); // auto-replaced at kickoff, still playable
  });

  it('flags a missing goalkeeper as a hard error', () => {
    const sq = autoPickSquad(w, clubId);
    const outfieldBench = sq.bench.find((id) => w.players[id].position !== 'GK');
    expect(outfieldBench).toBeDefined();
    const gkId = sq.startingXI.find((id) => w.players[id].position === 'GK') as string;
    const broken = { ...sq, startingXI: sq.startingXI.map((id) => (id === gkId ? (outfieldBench as string) : id)) };
    expect(validateXI(w, broken, clubId).some((i) => i.type === 'no-gk')).toBe(true);
    expect(isPlayableXI(w, broken, clubId)).toBe(false);
  });

  it('transfers roles from the outgoing player to the substitute', () => {
    const sq = autoPickSquad(w, clubId);
    const captainId = sq.roles.captainId as string;
    // give the captain every role, then sub them off
    const withRoles = setRole(setRole(sq, 'penaltyTakerId', captainId), 'freeKickTakerId', captainId);
    const inId = withRoles.bench[0];
    const swapped = swapPlayer(withRoles, captainId, inId);

    expect(swapped.startingXI).toContain(inId);
    expect(swapped.startingXI).not.toContain(captainId);
    expect(swapped.roles.captainId).toBe(inId);
    expect(swapped.roles.penaltyTakerId).toBe(inId);
    expect(swapped.roles.freeKickTakerId).toBe(inId);
    // no more "role not in XI" complaints
    expect(validateXI(w, swapped, clubId).some((i) => i.type === 'role-not-in-xi')).toBe(false);
  });

  it('swaps the slots of two starters without touching the bench or roles', () => {
    const sq = autoPickSquad(w, clubId);
    const aId = sq.startingXI[1];
    const bId = sq.startingXI[4];
    const swapped = swapStarters(sq, aId, bId);

    expect(swapped.startingXI[1]).toBe(bId);
    expect(swapped.startingXI[4]).toBe(aId);
    expect(swapped.startingXI.length).toBe(11);
    expect(swapped.bench).toEqual(sq.bench);
    expect(swapped.roles).toEqual(sq.roles);
    // same set of players, just reordered
    expect([...swapped.startingXI].sort()).toEqual([...sq.startingXI].sort());
  });

  it('leaves the squad unchanged when a player is not a starter', () => {
    const sq = autoPickSquad(w, clubId);
    expect(swapStarters(sq, sq.startingXI[0], sq.bench[0])).toBe(sq);
  });

  it('flags a role assigned to a benched player', () => {
    const sq = autoPickSquad(w, clubId);
    const broken = setRole(sq, 'captainId', sq.bench[0]);
    expect(validateXI(w, broken, clubId).some((i) => i.type === 'role-not-in-xi')).toBe(true);
  });

  it('toggles training players in and out and caps the slots', () => {
    const sq = autoPickSquad(w, clubId);
    const [a, b, c, d] = sq.startingXI;

    const one = toggleTraining(sq, a);
    expect(one.trainingIds).toEqual([a]);

    const three = toggleTraining(toggleTraining(one, b), c);
    expect(three.trainingIds).toEqual([a, b, c]);
    expect(three.trainingIds?.length).toBe(TRAINING.SLOTS);

    // a fourth add is ignored (slots full) and returns the same reference
    expect(toggleTraining(three, d)).toBe(three);

    // toggling an existing one removes it, freeing a slot
    const removed = toggleTraining(three, b);
    expect(removed.trainingIds).toEqual([a, c]);
    expect(toggleTraining(removed, d).trainingIds).toEqual([a, c, d]);
  });

  it('clears a training slot when the player leaves the squad', () => {
    const sq = autoPickSquad(w, clubId);
    const id = sq.startingXI[3];
    const withTraining = toggleTraining(sq, id);
    expect(withTraining.trainingIds).toContain(id);

    const after = removeFromSquad(withTraining, id);
    expect(after.trainingIds ?? []).not.toContain(id);
    expect(after.startingXI).not.toContain(id);
  });

  it('treats off-formation selections as warnings, not errors', () => {
    // a valid XI but mislabelled formation (claim 4-3-3 while fielding 4-4-2)
    const sq = { ...autoPickSquad(w, clubId), formation: '4-3-3' as const };
    const issues = validateXI(w, sq, clubId);
    expect(issues.some((i) => i.type === 'off-position')).toBe(true);
    expect(isPlayableXI(w, sq, clubId)).toBe(true); // still playable
  });
});
