import { generateWorld } from '../content';
import { autoPickSquad, isPlayableXI, setRole, swapPlayer, validateXI } from '../world';

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

  it('flags a role assigned to a benched player', () => {
    const sq = autoPickSquad(w, clubId);
    const broken = setRole(sq, 'captainId', sq.bench[0]);
    expect(validateXI(w, broken, clubId).some((i) => i.type === 'role-not-in-xi')).toBe(true);
  });

  it('treats off-formation selections as warnings, not errors', () => {
    // a valid XI but mislabelled formation (claim 4-3-3 while fielding 4-4-2)
    const sq = { ...autoPickSquad(w, clubId), formation: '4-3-3' as const };
    const issues = validateXI(w, sq, clubId);
    expect(issues.some((i) => i.type === 'off-position')).toBe(true);
    expect(isPlayableXI(w, sq, clubId)).toBe(true); // still playable
  });
});
