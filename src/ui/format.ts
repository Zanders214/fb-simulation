import type { CardType, GoalType, Player, Position } from '../engine';
import type { Theme } from '../theme';

/** Conventional, theme-independent card colours (amber / red). */
export const CARD_COLORS: Record<CardType, string> = {
  yellow: '#f1c40f',
  red: '#e74c3c',
};

export function cardEmoji(type: CardType): string {
  return type === 'yellow' ? '🟨' : '🟥';
}

/** `1 match` / `3 matches`. */
export function matchesLabel(n: number): string {
  return `${n} ${n === 1 ? 'match' : 'matches'}`;
}

export interface Availability {
  kind: 'injured' | 'suspended';
  matches: number;
  /** Short status line, e.g. "Injured · 3 matches". */
  label: string;
}

/** A player's current unavailability (injury takes precedence), or null if fit. */
export function playerAvailability(player: Player): Availability | null {
  const injured = player.injuredMatches ?? 0;
  if (injured > 0) return { kind: 'injured', matches: injured, label: `Injured · ${matchesLabel(injured)}` };
  const suspended = player.suspendedMatches ?? 0;
  if (suspended > 0) return { kind: 'suspended', matches: suspended, label: `Suspended · ${matchesLabel(suspended)}` };
  return null;
}

/** Colour for an availability status: amber for injuries, red for suspensions. */
export function availabilityColor(kind: Availability['kind']): string {
  return kind === 'injured' ? '#e67e22' : CARD_COLORS.red;
}

/** Position tag colours are conventional (GK gold, DEF blue, …) and theme-independent. */
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

export function ratingColor(r: number, theme: Theme): string {
  if (r >= 7.5) return theme.colors.win;
  if (r >= 6.5) return '#8bc34a';
  if (r >= 5.5) return theme.colors.draw;
  return theme.colors.loss;
}

export function overallColor(ovr: number, theme: Theme): string {
  if (ovr >= 82) return theme.colors.win;
  if (ovr >= 72) return '#8bc34a';
  if (ovr >= 62) return theme.colors.draw;
  return theme.colors.textMuted;
}

/** Format a money amount (stored in thousands) as e.g. €90.0M / €750K / €0. */
export function formatMoney(thousands: number): string {
  if (thousands <= 0) return '€0';
  if (thousands >= 1000) {
    const m = thousands / 1000;
    return `€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return `€${Math.round(thousands)}K`;
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

export function formColor(form: number, theme: Theme): string {
  if (form >= 1.5) return theme.colors.win;
  if (form <= -1.5) return theme.colors.loss;
  return theme.colors.textMuted;
}
