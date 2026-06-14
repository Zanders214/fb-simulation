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
    seasonCleanSheets: opts.seasonCleanSheets ?? 0,
    careerGoals: opts.careerGoals ?? 0,
    careerAssists: opts.careerAssists ?? 0,
    careerApps: opts.careerApps ?? 0,
    careerCleanSheets: opts.careerCleanSheets ?? 0,
    peakValue: opts.peakValue ?? 0,
  };
}

/** Build an 11-player 4-4-2 with stats scaled around `level`. */
export function makeTeam(clubId: string, level: number, roles: SquadRoles = {}, homeAdvantage = false): SimTeam {
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
  return { clubId, players, roles, homeAdvantage };
}
