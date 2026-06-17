import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { Club, RecentResult } from '../../engine';
import { useThemedStyles, type Theme } from '../../theme';
import type { HomeData } from './homeData';

/** Navigation handlers wired by the orchestrator (kept stable). */
export interface HomeNav {
  onContinue: () => void;
  onSquad: () => void;
  onMarket: () => void;
  onTable: () => void;
  onSettings: () => void;
}

export interface LayoutProps {
  data: HomeData;
  nav: HomeNav;
  insets: EdgeInsets;
  theme: Theme;
}

export const GRAD_START = { x: 0, y: 0 } as const;
export const GRAD_END = { x: 1, y: 1 } as const;

/** Signed goal difference, e.g. `+11` / `-3` / `0`. */
export function gdText(gd: number): string {
  return gd > 0 ? `+${gd}` : `${gd}`;
}

export function venueLabel(isHome: boolean): string {
  return isHome ? 'HOME' : 'AWAY';
}

/** A club crest: a colour-filled square (or circle) showing the 3-letter code. */
export function HomeBadge({
  club,
  size,
  radius,
  font,
}: Readonly<{ club: Club; size: number; radius: number; font: string }>) {
  const boxStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: club.primaryColor,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [size, radius, club.primaryColor],
  );
  const textStyle = useMemo(
    () => ({
      color: '#ffffff',
      fontFamily: font,
      fontWeight: '800' as const,
      fontSize: Math.max(10, Math.round(size * 0.34)),
    }),
    [font, size],
  );
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{club.shortName}</Text>
    </View>
  );
}

function formStyle(r: RecentResult, styles: ReturnType<typeof makeFormStyles>) {
  if (r === 'W') return styles.w;
  if (r === 'L') return styles.l;
  return styles.d;
}

/** A coloured W/D/L streak (oldest-first). */
export function FormRow({ form, mono }: Readonly<{ form: RecentResult[]; mono?: boolean }>) {
  const styles = useThemedStyles(makeFormStyles);
  if (form.length === 0) return <Text style={styles.empty}>—</Text>;
  // Form is positional history (never reordered); a value+index id gives stable keys.
  const letters = form.map((r, i) => ({ id: `${i}${r}`, r }));
  return (
    <View style={styles.row}>
      {letters.map((e) => (
        <Text key={e.id} style={[mono ? styles.letterMono : styles.letter, formStyle(e.r, styles)]}>
          {e.r}
        </Text>
      ))}
    </View>
  );
}

const makeFormStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 4 },
    letter: { fontFamily: theme.fonts.heading, fontWeight: '800', fontSize: 14 },
    letterMono: { fontFamily: theme.fonts.numeric, fontWeight: '700', fontSize: 14 },
    empty: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 14 },
    w: { color: theme.colors.win },
    d: { color: theme.colors.draw },
    l: { color: theme.colors.loss },
  });
