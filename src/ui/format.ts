import type { GoalType, Position } from '../engine';
import type { Theme } from '../theme';

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

/**
 * Emoji flag per nationality. Keys match the names in engine `NATIONALITIES`.
 * England has no country-code emoji, so it uses the St George's cross tag
 * sequence; every other nation is a regional-indicator pair.
 */
const NATIONALITY_FLAGS: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Netherlands: '🇳🇱',
  Portugal: '🇵🇹',
  Brazil: '🇧🇷',
  Argentina: '🇦🇷',
  Belgium: '🇧🇪',
  Croatia: '🇭🇷',
  Denmark: '🇩🇰',
  Sweden: '🇸🇪',
  Norway: '🇳🇴',
  Poland: '🇵🇱',
  Switzerland: '🇨🇭',
  Austria: '🇦🇹',
  Greece: '🇬🇷',
  Turkey: '🇹🇷',
  Japan: '🇯🇵',
  'United States': '🇺🇸',
  Mexico: '🇲🇽',
  Nigeria: '🇳🇬',
  Senegal: '🇸🇳',
  Colombia: '🇨🇴',
  Uruguay: '🇺🇾',
  Ghana: '🇬🇭',
  Morocco: '🇲🇦',
};

/** Emoji flag for a player's nationality; falls back to the name if unmapped. */
export function flagFor(nationality: string): string {
  return NATIONALITY_FLAGS[nationality] ?? nationality;
}
