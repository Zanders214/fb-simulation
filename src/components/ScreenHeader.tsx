import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { HeaderHomeButton } from './HeaderHomeButton';

/**
 * The app-wide screen header, rendered through each navigator's
 * `screenOptions.header` so it stays pinned like a native header. Its structure
 * changes per `theme.style`:
 *
 * - **Broadcast** — full-bleed green gradient banner, gold accent rule, an
 *   uppercase condensed title over a small kicker.
 * - **Programme** — flat paper bar, serif title with a solid underline rule.
 * - **Terminal** — compact bordered bar with a monospace `CODE_KICKER` line.
 */
export interface ScreenHeaderProps {
  title: string;
  /** Eyebrow line; defaults to the managed club's name when a game is loaded. */
  kicker?: string;
  showBack?: boolean;
  showHome?: boolean;
}

interface HeaderViewProps {
  theme: Theme;
  insets: EdgeInsets;
  title: string;
  kicker?: string;
  showBack: boolean;
  showHome: boolean;
}

const GRAD_START = { x: 0, y: 0 } as const;
const GRAD_END = { x: 1, y: 1 } as const;

/** Light text on the broadcast gradient (dark in both modes); palette text elsewhere. */
function chromeColor(theme: Theme): string {
  return theme.style === 'broadcast' ? theme.colors.onPrimary : theme.colors.text;
}

/** Terminal eyebrow: `Riverside United` → `RIVERSIDE_UNITED`. */
function terminalKicker(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '_');
}

function BackControl() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const onPress = useCallback(() => router.back(), [router]);
  if (!router.canGoBack()) return null;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={styles.side}>
      <Text style={styles.backGlyph}>‹</Text>
    </Pressable>
  );
}

function BroadcastHeader({ theme, insets, title, kicker, showBack, showHome }: Readonly<HeaderViewProps>) {
  const styles = useThemedStyles(makeStyles);
  const gradient = useMemo(() => [theme.colors.primary, theme.colors.primaryDark] as const, [theme]);
  const topPad = useMemo(() => ({ paddingTop: insets.top + 8 }), [insets.top]);
  return (
    <LinearGradient colors={gradient} start={GRAD_START} end={GRAD_END} style={[styles.bcBanner, topPad]}>
      <View style={styles.row}>
        {showBack ? <BackControl /> : null}
        <View style={styles.titleWrap}>
          {kicker ? (
            <Text style={styles.bcKicker} numberOfLines={1}>
              {kicker.toUpperCase()}
            </Text>
          ) : null}
          <Text style={styles.bcTitle} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
        </View>
        {showHome ? <HeaderHomeButton color={theme.colors.onPrimary} /> : null}
      </View>
    </LinearGradient>
  );
}

function ProgrammeHeader({ theme, insets, title, kicker, showBack, showHome }: Readonly<HeaderViewProps>) {
  const styles = useThemedStyles(makeStyles);
  const topPad = useMemo(() => ({ paddingTop: insets.top + 12 }), [insets.top]);
  return (
    <View style={[styles.pgBar, topPad]}>
      <View style={styles.row}>
        {showBack ? <BackControl /> : null}
        <View style={styles.titleWrap}>
          {kicker ? (
            <Text style={styles.pgKicker} numberOfLines={1}>
              {kicker}
            </Text>
          ) : null}
          <View style={styles.pgUnderline}>
            <Text style={styles.pgTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
        {showHome ? <HeaderHomeButton color={theme.colors.text} /> : null}
      </View>
    </View>
  );
}

function TerminalHeader({ theme, insets, title, kicker, showBack, showHome }: Readonly<HeaderViewProps>) {
  const styles = useThemedStyles(makeStyles);
  const topPad = useMemo(() => ({ paddingTop: insets.top + 6 }), [insets.top]);
  const code = useMemo(() => (kicker ? terminalKicker(kicker) : undefined), [kicker]);
  return (
    <View style={[styles.tmBar, topPad]}>
      <View style={styles.row}>
        {showBack ? <BackControl /> : null}
        <View style={styles.titleWrap}>
          {code ? (
            <Text style={styles.tmKicker} numberOfLines={1}>
              {code}
            </Text>
          ) : null}
          <Text style={styles.tmTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {showHome ? <HeaderHomeButton color={theme.colors.text} /> : null}
      </View>
    </View>
  );
}

/** Narrow subscription: just the managed club's name (re-renders only when it changes). */
function useDefaultKicker(): string | undefined {
  return useGameStore((s) => (s.game ? s.game.world.clubs[s.game.managedClubId]?.name : undefined));
}

export function ScreenHeader({ title, kicker, showBack = true, showHome = false }: Readonly<ScreenHeaderProps>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const fallbackKicker = useDefaultKicker();
  const props: HeaderViewProps = {
    theme,
    insets,
    title,
    kicker: kicker ?? fallbackKicker,
    showBack,
    showHome,
  };
  if (theme.style === 'programme') return <ProgrammeHeader {...props} />;
  if (theme.style === 'terminal') return <TerminalHeader {...props} />;
  return <BroadcastHeader {...props} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
    side: { minWidth: 24, alignItems: 'flex-start', justifyContent: 'center' },
    titleWrap: { flex: 1, minWidth: 0 },
    backGlyph: { color: chromeColor(theme), fontSize: 34, lineHeight: 36, marginTop: -4 },

    // Broadcast — full-bleed gradient banner with a gold accent rule.
    bcBanner: {
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(1.25),
    },
    bcKicker: {
      color: theme.colors.accent,
      fontFamily: theme.fonts.numeric,
      fontSize: 12,
      letterSpacing: 2,
      marginBottom: 1,
    },
    bcTitle: {
      color: theme.colors.onPrimary,
      fontFamily: theme.fonts.heading,
      fontWeight: theme.fonts.headingWeight,
      fontSize: 30,
      letterSpacing: 0.5,
    },

    // Programme — flat paper, serif title with a solid underline.
    pgBar: {
      backgroundColor: theme.colors.bg,
      paddingHorizontal: theme.spacing(2.5),
      paddingBottom: theme.spacing(1.75),
    },
    pgKicker: {
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
      fontSize: 11,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    pgUnderline: { alignSelf: 'flex-start', borderBottomWidth: 2, borderBottomColor: theme.colors.text },
    pgTitle: {
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
      fontWeight: theme.fonts.headingWeight,
      fontSize: 27,
      paddingBottom: 2,
    },

    // Terminal — compact bordered bar with a monospace code line.
    tmBar: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    },
    tmKicker: {
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.numeric,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 1,
    },
    tmTitle: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 18 },
  });
