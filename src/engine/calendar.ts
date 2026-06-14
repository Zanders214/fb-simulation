/**
 * Derived match calendar.
 *
 * The engine has no stored dates — time is `season.number` + `season.currentMatchday`
 * (see types.ts). To render a FIFA-style calendar we map each matchday onto a real
 * date *deterministically*, so nothing extra is persisted and no save migration is
 * needed. All arithmetic is in UTC so results never depend on the device timezone
 * (matching the engine's "no clock" discipline).
 *
 * Cadence: a realistic Aug–spring spread — mostly weekly Saturdays, a few midweek
 * (Wednesday) rounds, plus international/winter breaks — rather than a rigid weekly
 * grid. Only `seasonMatchdayDates` knows the cadence; swap its body to retune the
 * schedule without touching the store or UI.
 */
import { fixturesForMatchday } from './season';
import type { Fixture, GameState } from './types';

export const BASE_YEAR = 2025; // season 1 kicks off in August 2025
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_GAP = 7; // Sat -> Sat
const MIDWEEK_LEAD = 4; // Sat -> Wed
const MIDWEEK_TRAIL = 3; // Wed -> Sat

/** Matchdays that fall midweek (Wednesday). Must be isolated and never first/last. */
const MIDWEEK_MATCHDAYS = [6, 20];
/** Extra-long Sat->Sat gaps (in days), keyed by the matchday you leave FROM. */
const BREAKS: Readonly<Record<number, number>> = {
  3: 14, // early international break
  7: 14,
  11: 14,
  16: 28, // winter break (~4 weeks)
  24: 14,
  28: 14, // spring international break
};

export const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---- low-level date helpers (UTC, dependency-free, unit-tested) ----

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** e.g. "Sat 4 Oct". */
export function formatShortDate(date: Date): string {
  return `${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

/** First Saturday on or after 1 August of `year`. */
function firstSaturdayOfAugust(year: number): Date {
  const aug1 = new Date(Date.UTC(year, 7, 1));
  const toSaturday = (6 - aug1.getUTCDay() + 7) % 7; // 0 if Aug 1 is already a Saturday
  return new Date(Date.UTC(year, 7, 1 + toSaturday));
}

// ---- the schedule ----

/**
 * Dates for every matchday of a season, indexed [0] = matchday 1. Strictly
 * increasing, each landing on a Saturday or Wednesday, starting in August.
 */
export function seasonMatchdayDates(seasonNumber: number, totalMatchdays: number): Date[] {
  const year = BASE_YEAR + (seasonNumber - 1);
  const midweek = new Set(MIDWEEK_MATCHDAYS.filter((m) => m > 1 && m < totalMatchdays));

  let cursor = firstSaturdayOfAugust(year);
  const dates: Date[] = [cursor];
  for (let from = 1; from < totalMatchdays; from++) {
    const to = from + 1;
    let gap: number;
    if (midweek.has(to)) gap = MIDWEEK_LEAD; // arriving at a midweek round
    else if (midweek.has(from)) gap = MIDWEEK_TRAIL; // leaving a midweek round
    else gap = BREAKS[from] ?? DEFAULT_GAP;
    cursor = addDays(cursor, gap);
    dates.push(cursor);
  }
  return dates;
}

export function matchdayDate(seasonNumber: number, matchday: number, totalMatchdays: number): Date {
  return seasonMatchdayDates(seasonNumber, totalMatchdays)[matchday - 1];
}

/** The date the player is currently "at" — the next match, or the last one if the season is over. */
export function currentDate(state: GameState): Date {
  const { season } = state;
  const dates = seasonMatchdayDates(season.number, season.totalMatchdays);
  const idx = Math.min(season.currentMatchday, season.totalMatchdays) - 1;
  return dates[idx];
}

export function seasonStartDate(state: GameState): Date {
  return matchdayDate(state.season.number, 1, state.season.totalMatchdays);
}

export function seasonEndDate(state: GameState): Date {
  return matchdayDate(state.season.number, state.season.totalMatchdays, state.season.totalMatchdays);
}

/**
 * The matchday to simulate to for a tapped date: the last matchday on or before
 * `date`. Returns null when there is nothing new to play (the date is before the
 * next match, or the season is already complete). Kept within the current season.
 */
export function dateToTargetMatchday(state: GameState, date: Date): number | null {
  const { season } = state;
  const dates = seasonMatchdayDates(season.number, season.totalMatchdays);
  const t = date.getTime();
  let target = 0;
  for (let m = 1; m <= season.totalMatchdays; m++) {
    if (dates[m - 1].getTime() <= t) target = m;
    else break;
  }
  return target >= season.currentMatchday ? target : null;
}

export interface ScheduleEntry {
  matchday: number;
  date: Date;
  fixtures: Fixture[];
}

/** Per-matchday date + fixtures for the current season; the calendar's marker source. */
export function enumerateSchedule(state: GameState): ScheduleEntry[] {
  const { season } = state;
  const dates = seasonMatchdayDates(season.number, season.totalMatchdays);
  const out: ScheduleEntry[] = [];
  for (let m = 1; m <= season.totalMatchdays; m++) {
    out.push({ matchday: m, date: dates[m - 1], fixtures: fixturesForMatchday(state, m) });
  }
  return out;
}
