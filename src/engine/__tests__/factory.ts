import type { SimTeam } from '../sim';
import type { Player, Position, SquadRoles } from '../types';

let counter = 0;

export function makePlayer(
  opts: Partial<Player> & {
    position: Position;
    attacking?: number;
    defending?: number;
    midfield?: number;
  },
): Player {
  const id = opts.id ?? `tp${counter++}`;
  return {
    id,
    clubId: opts.clubId ?? 'TEST',
    firstName: opts.firstName ?? 'Test',
    lastName: opts.lastName ?? id,
    name: opts.name ?? `Test ${id}`,
    nationality: opts.nationality ?? 'Testland',
    age: opts.age ?? 25,
    position: opts.position,
    attrs: opts.attrs ?? {
      attacking: opts.attacking ?? 50,
      defending: opts.defending ?? 50,
      midfield: opts.midfield ?? 50,
    },
    potential: opts.potential ?? 80,
    form: opts.form ?? 0,
    growthXp: opts.growthXp ?? 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonApps: 0,
    seasonSubApps: opts.seasonSubApps ?? 0,
    seasonCleanSheets: opts.seasonCleanSheets ?? 0,
    seasonYellowCards: opts.seasonYellowCards ?? 0,
    seasonRedCards: opts.seasonRedCards ?? 0,
    careerGoals: opts.careerGoals ?? 0,
    careerAssists: opts.careerAssists ?? 0,
    careerApps: opts.careerApps ?? 0,
    careerSubApps: opts.careerSubApps ?? 0,
    careerCleanSheets: opts.careerCleanSheets ?? 0,
    careerYellowCards: opts.careerYellowCards ?? 0,
    careerRedCards: opts.careerRedCards ?? 0,
    peakValue: opts.peakValue ?? 0,
    injuredMatches: opts.injuredMatches,
    suspendedMatches: opts.suspendedMatches,
  };
}

/**
 * Build an 11-player 4-4-2 with stats scaled around `level`. Pass `benchLevel`
 * to add a 7-man bench (1 GK, 2 DEF, 2 MID, 2 FWD) scaled around that level, so
 * substitutions can be exercised.
 */
export function makeTeam(
  clubId: string,
  level: number,
  roles: SquadRoles = {},
  homeAdvantage = false,
  benchLevel?: number,
): SimTeam {
  const players: Player[] = [];
  players.push(makePlayer({ id: `${clubId}_GK`, clubId, position: 'GK', defending: level, attacking: level - 25, midfield: level - 15 }));
  for (let i = 0; i < 4; i++) {
    players.push(makePlayer({ id: `${clubId}_DEF${i}`, clubId, position: 'DEF', defending: level + 5, attacking: level - 12, midfield: level - 3 }));
  }
  for (let i = 0; i < 4; i++) {
    players.push(makePlayer({ id: `${clubId}_MID${i}`, clubId, position: 'MID', midfield: level + 5, attacking: level - 2, defending: level - 4 }));
  }
  for (let i = 0; i < 2; i++) {
    players.push(makePlayer({ id: `${clubId}_FWD${i}`, clubId, position: 'FWD', attacking: level + 8, midfield: level - 4, defending: level - 14 }));
  }
  if (benchLevel === undefined) return { clubId, players, roles, homeAdvantage };

  const b = benchLevel;
  const bench: Player[] = [
    makePlayer({ id: `${clubId}_SGK`, clubId, position: 'GK', defending: b, attacking: b - 25, midfield: b - 15 }),
    makePlayer({ id: `${clubId}_SDEF0`, clubId, position: 'DEF', defending: b + 5, attacking: b - 12, midfield: b - 3 }),
    makePlayer({ id: `${clubId}_SDEF1`, clubId, position: 'DEF', defending: b + 5, attacking: b - 12, midfield: b - 3 }),
    makePlayer({ id: `${clubId}_SMID0`, clubId, position: 'MID', midfield: b + 5, attacking: b - 2, defending: b - 4 }),
    makePlayer({ id: `${clubId}_SMID1`, clubId, position: 'MID', midfield: b + 5, attacking: b - 2, defending: b - 4 }),
    makePlayer({ id: `${clubId}_SFWD0`, clubId, position: 'FWD', attacking: b + 8, midfield: b - 4, defending: b - 14 }),
    makePlayer({ id: `${clubId}_SFWD1`, clubId, position: 'FWD', attacking: b + 8, midfield: b - 4, defending: b - 14 }),
  ];
  return { clubId, players, bench, roles, homeAdvantage };
}
