import type { GoalType, Position } from '../engine';
import { theme } from '../theme';

export function positionColor(pos: Position): string {
  switch (pos) {
    case 'GK':
      return '#e0a800';
    case 'DEF':
      return '#2f80c7';
    case 'MID':
      return '#27ae60';
    case 'FWD':
      return '#d24b4b';
  }
}

export function ratingColor(r: number): string {
  if (r >= 7.5) return theme.colors.win;
  if (r >= 6.5) return '#8bc34a';
  if (r >= 5.5) return theme.colors.draw;
  return theme.colors.loss;
}

export function overallColor(ovr: number): string {
  if (ovr >= 82) return theme.colors.win;
  if (ovr >= 72) return '#8bc34a';
  if (ovr >= 62) return theme.colors.draw;
  return theme.colors.textMuted;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function goalTypeTag(t: GoalType): string {
  switch (t) {
    case 'penalty':
      return ' (pen)';
    case 'free_kick':
      return ' (fk)';
    case 'header':
      return ' (h)';
    default:
      return '';
  }
}

export function formSymbol(form: number): string {
  if (form >= 1.5) return '▲';
  if (form <= -1.5) return '▼';
  return '–';
}

export function formColor(form: number): string {
  if (form >= 1.5) return theme.colors.win;
  if (form <= -1.5) return theme.colors.loss;
  return theme.colors.textMuted;
}
