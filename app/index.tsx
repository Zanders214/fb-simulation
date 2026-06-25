/**
 * Home screen — V3 "Editorial Scoreboard".
 *
 * The boldest, most brand-led launch screen: a green header panel with the
 * upcoming matchday + next-fixture scoreboard, then top-scorer / avg-rating stat
 * cards, a standings ticker, and a gold "PLAY MATCHDAY N" CTA. First run (no
 * save) keeps the original centered hero + New Game / Settings.
 *
 * Ported from the Claude Design handoff (variation 03) to this repo's conventions:
 * the dynamic theme (`useTheme` / `useThemedStyles`), `confirmAction`, and the
 * condensed display font loaded in `app/_layout.tsx`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { leagueTable, matchdayDate, nextUserFixture, type GameState } from '../src/engine';
import { useGameStore } from '../src/store/gameStore';
import { clubPlayers, userClub } from '../src/store/selectors';
import { confirmAction } from '../src/ui/confirm';
import { condensed } from '../src/ui/fonts';
import { ordinal } from '../src/ui/format';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty'];

/** Spell a matchday number (1..~59) for the editorial title. Falls back to digits. */
function matchdayWord(n: number): string {
  if (n < 0 || n > 59) return String(n);
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

// ~160° diagonal, matching the design's header gradient.
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SAT · 16 AUG" from the deterministic matchday date (engine has no clock time). */
function dateLabel(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** First initial + surname, e.g. "L. Okonkwo". */
function shortPlayerName(firstName: string, lastName: string): string {
  return firstName ? `${firstName[0]}. ${lastName}` : lastName;
}

/** Leading scorer on a club this season (by `seasonGoals`), or null. */
function computeTopScorer(game: GameState, clubId: string): { name: string; goals: number } | null {
  let best: { name: string; goals: number } | null = null;
  for (const p of clubPlayers(game, clubId)) {
    const goals = p.seasonGoals ?? 0;
    if (goals > 0 && (!best || goals > best.goals)) {
      best = { name: shortPlayerName(p.firstName, p.lastName), goals };
    }
  }
  return best;
}

/** Highest average match rating on a club this season (derived from fixtures), or null. */
function computeTopRated(game: GameState, clubId: string): { name: string; avg: number } | null {
  const tally = new Map<string, { sum: number; count: number }>();
  for (const f of game.season.fixtures) {
    if (!f.result) continue;
    for (const [pid, r] of Object.entries(f.result.ratings)) {
      if (game.world.players[pid]?.clubId !== clubId) continue;
      const t = tally.get(pid) ?? { sum: 0, count: 0 };
      t.sum += r.rating;
      t.count += 1;
      tally.set(pid, t);
    }
  }
  let best: { name: string; avg: number } | null = null;
  for (const [pid, t] of tally) {
    const avg = t.sum / t.count;
    if (!best || avg > best.avg) {
      const p = game.world.players[pid];
      best = { name: shortPlayerName(p.firstName, p.lastName), avg };
    }
  }
  return best;
}

/** Crest = 3-letter club code on a rounded square in the club's primary colour. */
function Crest({ code, color, size = 36 }: Readonly<{ code: string; color: string; size?: number }>) {
  const boxStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size * 0.25,
      backgroundColor: color,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [size, color],
  );
  const textStyle = useMemo(
    () => ({ color: '#fff', fontFamily: condensed.extra, fontSize: size * 0.42 }),
    [size],
  );
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{code}</Text>
    </View>
  );
}

/** Everything the editorial scoreboard needs, derived from the active game. */
function useHomeSummary() {
  const game = useGameStore((s) => s.game);
  return useMemo(() => {
    if (!game) return null;

    const club = userClub(game);
    const league = game.world.leagues[club.leagueId];
    const table = leagueTable(game);

    // Next fixture (undefined once the season is complete).
    const next = nextUserFixture(game);
    const fixture = next
      ? {
          home: game.world.clubs[next.homeClubId],
          away: game.world.clubs[next.awayClubId],
          when: dateLabel(matchdayDate(game.season.number, next.matchday, game.season.totalMatchdays)),
        }
      : null;

    return {
      game,
      league,
      table,
      fixture,
      topScorer: computeTopScorer(game, game.managedClubId),
      topRated: computeTopRated(game, game.managedClubId),
    };
  }, [game]);
}

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hasHydrated = useGameStore((s) => s.hasHydrated);
  const hasSave = useGameStore((s) => s.game !== null);
  const summary = useHomeSummary();

  const startNewGame = useCallback(() => {
    if (hasSave) {
      confirmAction({
        title: 'Start a new game?',
        message: 'This will replace your current save.',
        confirmLabel: 'New Game',
        destructive: true,
        onConfirm: () => router.push('/new-game'),
      });
    } else {
      router.push('/new-game');
    }
  }, [hasSave, router]);

  const goToSeason = useCallback(() => router.push('/season'), [router]);
  const goToSettings = useCallback(() => router.push('/settings'), [router]);

  const gradientColors = useMemo(
    () => [theme.colors.primary, theme.colors.primaryDark] as const,
    [theme.colors.primary, theme.colors.primaryDark],
  );

  if (!hasHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  // ---- No save yet: simple hero + New Game (keeps the original first-run feel) ----
  if (!hasSave || !summary) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.hero}>
          <View style={styles.appCrestLg}>
            <Text style={styles.appCrestLgText}>FB</Text>
          </View>
          <Text style={styles.kickerHero}>FOOTBALL MANAGER</Text>
          <Text style={styles.titleHero}>FB SIMULATION</Text>
          <Text style={styles.subtitle}>Build your club. Pick a league. Play the season.</Text>
        </View>
        <View style={styles.menu}>
          <Button label="New Game" onPress={startNewGame} testID="home-new-game" />
          <Button label="Settings" variant="ghost" onPress={goToSettings} testID="home-settings" />
        </View>
        <Text style={styles.footer}>pre-alpha · v0.3</Text>
      </SafeAreaView>
    );
  }

  const { game, league, table, fixture, topScorer, topRated } = summary;
  const nextMd = game.season.currentMatchday;
  const seasonDone = fixture === null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---- Header panel ---- */}
        <LinearGradient colors={gradientColors} start={GRADIENT_START} end={GRADIENT_END} style={styles.header}>
          <View style={styles.goldRule} />
          <View style={styles.ring} />

          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.brandRow}>
              <View style={styles.brandLeft}>
                <View style={styles.appCrestSm}>
                  <Text style={styles.appCrestSmText}>FB</Text>
                </View>
                <Text style={styles.brandWord}>FB SIMULATION</Text>
              </View>
              <Pressable onPress={goToSettings} style={styles.gearBtn} testID="home-settings">
                <Text style={styles.gearGlyph}>⚙</Text>
              </Pressable>
            </View>

            <Text style={styles.kicker}>
              Season {game.season.number} · {league.name}
            </Text>
            {seasonDone ? (
              <Text style={styles.matchdayTitle}>SEASON{'\n'}COMPLETE</Text>
            ) : (
              <Text style={styles.matchdayTitle}>MATCHDAY{'\n'}{matchdayWord(nextMd).toUpperCase()}</Text>
            )}

            {fixture && (
              <View style={styles.scoreboard}>
                <View style={styles.sbSide}>
                  <Crest code={fixture.home.shortName} color={fixture.home.primaryColor} />
                  <Text style={styles.sbName} numberOfLines={1}>
                    {fixture.home.name.split(' ')[0]}
                  </Text>
                </View>
                <View style={styles.sbCenter}>
                  <Text style={styles.sbVs}>VS</Text>
                  <Text style={styles.sbWhen}>{fixture.when}</Text>
                </View>
                <View style={styles.sbSide}>
                  <Crest code={fixture.away.shortName} color={fixture.away.primaryColor} />
                  <Text style={styles.sbName} numberOfLines={1}>
                    {fixture.away.name.split(' ')[0]}
                  </Text>
                </View>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>

        {/* ---- Body ---- */}
        <View style={styles.body}>
          {/* Stat cards */}
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TOP SCORER</Text>
              <Text style={[styles.statNum, styles.statNumGold]}>{topScorer ? topScorer.goals : '–'}</Text>
              <Text style={styles.statName} numberOfLines={1}>
                {topScorer ? topScorer.name : 'No goals yet'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>AVG RATING</Text>
              <Text style={[styles.statNum, styles.statNumWin]}>{topRated ? topRated.avg.toFixed(1) : '–'}</Text>
              <Text style={styles.statName} numberOfLines={1}>
                {topRated ? topRated.name : 'No matches yet'}
              </Text>
            </View>
          </View>

          {/* Standings ticker */}
          <View>
            <Text style={styles.sectionLabel}>STANDINGS</Text>
            <View style={styles.ticker}>
              {table.slice(0, 4).map((r, i) => {
                const c = game.world.clubs[r.clubId];
                const isMine = r.clubId === game.managedClubId;
                return (
                  <View key={r.clubId} style={[styles.tickerTile, isMine && styles.tickerTileMine]}>
                    <Text style={[styles.tickerPos, isMine && styles.goldText]}>{ordinal(i + 1).toUpperCase()}</Text>
                    <Text style={[styles.tickerCode, isMine && styles.goldText]}>{c.shortName}</Text>
                    <Text style={[styles.tickerPts, isMine && styles.goldText]}>{r.points}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.spacer} />

          {/* Primary CTA + text links */}
          <Pressable onPress={goToSeason} style={styles.cta} testID="home-continue">
            <Text style={styles.ctaText}>{seasonDone ? 'VIEW SEASON' : `PLAY MATCHDAY ${nextMd}`}</Text>
            <Text style={styles.ctaChevron}>›</Text>
          </Pressable>
          <View style={styles.links}>
            <Pressable onPress={startNewGame} testID="home-new-game">
              <Text style={styles.link}>New Game</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable onPress={goToSettings}>
              <Text style={styles.link}>Settings</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => {
  const sp = theme.spacing;
  // Gold-tint emphasis surfaces, derived from the active accent so they re-skin per theme.
  const accentFill = `${theme.colors.accent}1A`; // ~10%
  const accentBorder = `${theme.colors.accent}59`; // ~35%
  const onPanelMuted = 'rgba(255,255,255,0.7)';

  return StyleSheet.create({
    center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { flexGrow: 1 },

    // ---- empty / first-run ----
    emptyContainer: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      paddingHorizontal: sp(3),
      paddingVertical: sp(4),
      justifyContent: 'space-between',
    },
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sp(1.25) },
    appCrestLg: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appCrestLgText: { color: theme.colors.accent, fontFamily: condensed.extra, fontSize: 34 },
    kickerHero: { color: theme.colors.accent, fontFamily: condensed.semibold, fontSize: 14, letterSpacing: 5 },
    titleHero: { color: theme.colors.text, fontFamily: condensed.extra, fontSize: 42, letterSpacing: 0.5 },
    subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', paddingHorizontal: sp(2) },
    menu: { gap: sp(1.5) },
    footer: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', marginTop: sp(2) },

    // ---- header panel ----
    header: { paddingHorizontal: sp(3), paddingBottom: sp(3.25), overflow: 'hidden' },
    headerSafe: { gap: 2 },
    goldRule: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: theme.colors.accent },
    ring: {
      position: 'absolute',
      right: -60,
      top: -30,
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 2,
      borderColor: `${theme.colors.accent}1A`,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp(2.25) },
    brandLeft: { flexDirection: 'row', alignItems: 'center', gap: sp(1.25) },
    appCrestSm: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.bg,
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appCrestSmText: { color: theme.colors.accent, fontFamily: condensed.extra, fontSize: 13 },
    brandWord: { color: theme.colors.onPrimary, fontFamily: condensed.bold, fontSize: 17, letterSpacing: 0.5 },
    gearBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearGlyph: { color: theme.colors.onPrimary, fontSize: 17 },

    kicker: {
      color: theme.colors.accent,
      fontFamily: condensed.semibold,
      fontSize: 13,
      letterSpacing: 4,
      textTransform: 'uppercase',
    },
    matchdayTitle: {
      color: theme.colors.onPrimary,
      fontFamily: condensed.extra,
      fontSize: 56,
      lineHeight: 50,
      letterSpacing: 0.5,
      marginTop: 2,
    },

    scoreboard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderRadius: 14,
      paddingHorizontal: sp(2.25),
      paddingVertical: sp(1.75),
      marginTop: sp(2.5),
    },
    sbSide: { flex: 1, alignItems: 'center', gap: sp(0.75) },
    sbName: { color: theme.colors.onPrimary, fontSize: 13, fontWeight: '600' },
    sbCenter: { alignItems: 'center', paddingHorizontal: sp(1) },
    sbVs: { color: theme.colors.accent, fontFamily: condensed.extra, fontSize: 22, letterSpacing: 1 },
    sbWhen: { color: onPanelMuted, fontSize: 11, letterSpacing: 1, marginTop: 2 },

    // ---- body ----
    body: { padding: sp(2.5), gap: sp(2), flexGrow: 1 },
    statRow: { flexDirection: 'row', gap: sp(1.5) },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      padding: sp(1.75),
    },
    statLabel: {
      color: theme.colors.textMuted,
      fontFamily: condensed.semibold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    statNum: { fontFamily: condensed.extra, fontSize: 32, lineHeight: 34, marginTop: sp(0.75) },
    statNumGold: { color: theme.colors.accent },
    statNumWin: { color: theme.colors.win },
    statName: { color: theme.colors.text, fontSize: 13, marginTop: 2 },

    sectionLabel: {
      color: theme.colors.textMuted,
      fontFamily: condensed.semibold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: sp(1),
    },
    ticker: { flexDirection: 'row', gap: sp(1) },
    tickerTile: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 11,
      paddingVertical: sp(1.25),
      paddingHorizontal: sp(0.75),
      alignItems: 'center',
      gap: 3,
    },
    tickerTileMine: { backgroundColor: accentFill, borderColor: accentBorder },
    tickerPos: { color: theme.colors.textMuted, fontFamily: condensed.bold, fontSize: 11 },
    tickerCode: { color: theme.colors.text, fontFamily: condensed.extra, fontSize: 15 },
    tickerPts: { color: theme.colors.textMuted, fontSize: 11 },
    goldText: { color: theme.colors.accent },

    spacer: { flexGrow: 1, minHeight: sp(1) },

    cta: {
      minHeight: 56,
      borderRadius: 13,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sp(1),
    },
    ctaText: { color: theme.colors.bg, fontFamily: condensed.extra, fontSize: 21, letterSpacing: 1 },
    ctaChevron: { color: theme.colors.bg, fontSize: 22, fontWeight: '800', marginTop: -2 },
    links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp(2) },
    link: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
    linkDot: { color: theme.colors.border },
  });
};
