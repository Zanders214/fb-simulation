import {
  BASE_YEAR,
  addDays,
  addMonths,
  currentDate,
  dateKey,
  dateToTargetMatchday,
  daysInMonth,
  diffDays,
  enumerateSchedule,
  isSameDay,
  matchdayDate,
  seasonEndDate,
  seasonMatchdayDates,
  seasonStartDate,
  startOfMonth,
} from '../calendar';
import { generateWorld } from '../content';
import { createGame, playMatchday } from '../season';
import type { GameState } from '../types';

const TOTAL = 30; // 16-club double round robin

function freshTakeover(seed = 2026): GameState {
  const w = generateWorld(seed);
  return createGame(w, { leagueId: 'L0', mode: 'takeover', takeoverClubId: w.leagues['L0'].clubIds[0] });
}

describe('seasonMatchdayDates', () => {
  const dates = seasonMatchdayDates(1, TOTAL);

  it('produces one strictly increasing date per matchday', () => {
    expect(dates.length).toBe(TOTAL);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
    }
  });

  it('lands every matchday on a Saturday or Wednesday', () => {
    for (const d of dates) expect([3, 6]).toContain(d.getUTCDay()); // Wed=3, Sat=6
  });

  it('starts in August of the base year and finishes before June', () => {
    expect(dates[0].getUTCFullYear()).toBe(BASE_YEAR);
    expect(dates[0].getUTCMonth()).toBe(7); // August
    expect(dates[TOTAL - 1].getUTCMonth()).toBeLessThan(5); // before June
  });

  it('moves each season forward exactly one year', () => {
    const s1 = seasonMatchdayDates(1, TOTAL)[0];
    const s2 = seasonMatchdayDates(2, TOTAL)[0];
    expect(s2.getUTCFullYear()).toBe(s1.getUTCFullYear() + 1);
    expect(s2.getUTCMonth()).toBe(7);
  });

  it('matchdayDate indexes the same array', () => {
    expect(matchdayDate(1, 1, TOTAL).getTime()).toBe(dates[0].getTime());
    expect(matchdayDate(1, TOTAL, TOTAL).getTime()).toBe(dates[TOTAL - 1].getTime());
  });
});

describe('currentDate / season bounds', () => {
  it('tracks the next matchday and clamps when complete', () => {
    const g = freshTakeover(1);
    const dates = seasonMatchdayDates(g.season.number, TOTAL);
    expect(currentDate(g).getTime()).toBe(dates[0].getTime());
    playMatchday(g);
    expect(currentDate(g).getTime()).toBe(dates[1].getTime());

    g.season.currentMatchday = TOTAL + 1; // force "complete"
    expect(currentDate(g).getTime()).toBe(dates[TOTAL - 1].getTime());
  });

  it('exposes the season start and end dates', () => {
    const g = freshTakeover(1);
    const dates = seasonMatchdayDates(g.season.number, TOTAL);
    expect(seasonStartDate(g).getTime()).toBe(dates[0].getTime());
    expect(seasonEndDate(g).getTime()).toBe(dates[TOTAL - 1].getTime());
  });
});

describe('dateToTargetMatchday', () => {
  it('maps a tapped date to the last matchday on or before it', () => {
    const g = freshTakeover(7);
    const dates = seasonMatchdayDates(g.season.number, TOTAL);
    expect(dateToTargetMatchday(g, dates[0])).toBe(1);
    expect(dateToTargetMatchday(g, dates[4])).toBe(5);
    expect(dateToTargetMatchday(g, addDays(dates[4], 1))).toBe(5); // between md5 and md6
    expect(dateToTargetMatchday(g, addDays(dates[TOTAL - 1], 40))).toBe(TOTAL); // clamped
  });

  it('returns null for a date that is not ahead of the next match', () => {
    const g = freshTakeover(7);
    const dates = seasonMatchdayDates(g.season.number, TOTAL);
    playMatchday(g);
    playMatchday(g); // currentMatchday is now 3
    expect(dateToTargetMatchday(g, dates[0])).toBeNull(); // md1 is in the past
    expect(dateToTargetMatchday(g, dates[2])).toBe(3);
  });
});

describe('enumerateSchedule', () => {
  it('returns every matchday with its fixtures', () => {
    const sched = enumerateSchedule(freshTakeover(3));
    expect(sched.length).toBe(TOTAL);
    expect(sched[0].matchday).toBe(1);
    expect(sched[0].fixtures.length).toBe(8); // 16 clubs / 2
  });
});

describe('grid date helpers', () => {
  it('handles month length, rollover, sameness and keys', () => {
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026 (not leap)
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)

    const dec = new Date(Date.UTC(2025, 11, 15));
    expect(addMonths(dec, 1).getUTCMonth()).toBe(0); // Dec -> Jan
    expect(addMonths(dec, 1).getUTCFullYear()).toBe(2026);
    expect(startOfMonth(dec).getUTCDate()).toBe(1);

    expect(isSameDay(new Date(Date.UTC(2025, 7, 2)), new Date(Date.UTC(2025, 7, 2, 18)))).toBe(true);
    expect(isSameDay(new Date(Date.UTC(2025, 7, 2)), new Date(Date.UTC(2025, 7, 3)))).toBe(false);
    expect(diffDays(new Date(Date.UTC(2025, 7, 2)), new Date(Date.UTC(2025, 7, 9)))).toBe(7);
    expect(dateKey(new Date(Date.UTC(2025, 7, 2)))).toBe('2025-08-02');
  });
});
