/**
 * Home screen — "Continue Dashboard".
 *
 * Foregrounds the match engine for a returning player: last result, recent form,
 * and a live peek at the league table, with a one-tap Continue into the season.
 * A first run (no save) falls back to the original centered hero + New Game / Settings.
 *
 * Ported from the Claude Design handoff (design_handoff_home_screen) to this repo's
 * conventions: the dynamic theme (`useTheme` / `useThemedStyles`) and `confirmAction`.
 */
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { leagueTable, type Fixture } from '../src/engine';
import { useGameStore } from '../src/store/gameStore';
import { userClub } from '../src/store/selectors';
import { confirmAction } from '../src/ui/confirm';
import { ordinal } from '../src/ui/format';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

type Outcome = 'W' | 'D' | 'L';

function outcomeColor(o: Outcome, theme: Theme): string {
  if (o === 'W') return theme.colors.win;
  if (o === 'D') return theme.colors.draw;
  return theme.colors.loss;
}

const crestBase = { alignItems: 'center', justifyContent: 'center' } as const;
const crestTextBase = { color: '#fff', fontWeight: '800' } as const;

/** Crest = 3-letter club code on a rounded square in the club's primary colour. */
function Crest({ code, color, size = 40 }: Readonly<{ code: string; color: string; size?: number }>) {
  const boxStyle = useMemo(
    () => [crestBase, { width: size, height: size, borderRadius: size * 0.27, backgroundColor: color }],
    [size, color],
  );
  const textStyle = useMemo(() => [crestTextBase, { fontSize: size * 0.4 }], [size]);
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{code}</Text>
    </View>
  );
}

/** Everything the home screen needs, derived from the active game. */
function useHomeSummary() {
  const game = useGameStore((s) => s.game);
  return useMemo(() => {
    if (!game) return null;

    const table = leagueTable(game);
    const pos = table.findIndex((r) => r.clubId === game.managedClubId) + 1;
    const row = table.find((r) => r.clubId === game.managedClubId);
    const club = userClub(game);

    const outcomeOf = (f: Fixture): Outcome => {
      const home = f.homeClubId === game.managedClubId;
      const gf = home ? f.result!.homeGoals : f.result!.awayGoals;
      const ga = home ? f.result!.awayGoals : f.result!.homeGoals;
      if (gf > ga) return 'W';
      if (gf < ga) return 'L';
      return 'D';
    };

    const mine = game.season.fixtures
      .filter(
        (f) =>
          f.result &&
          (f.homeClubId === game.managedClubId || f.awayClubId === game.managedClubId),
      )
      .sort((a, b) => a.matchday - b.matchday);

    const form = mine.slice(-5).map((f) => ({ id: f.id, o: outcomeOf(f) }));

    const lastFix = mine[mine.length - 1] ?? null;
    let last: null | {
      opp: ReturnType<typeof userClub>;
      us: number;
      them: number;
      matchday: number;
      scorers: string[];
    } = null;
    if (lastFix) {
      const home = lastFix.homeClubId === game.managedClubId;
      const oppId = home ? lastFix.awayClubId : lastFix.homeClubId;
      last = {
        opp: game.world.clubs[oppId],
        us: home ? lastFix.result!.homeGoals : lastFix.result!.awayGoals,
        them: home ? lastFix.result!.awayGoals : lastFix.result!.homeGoals,
        matchday: lastFix.matchday,
        scorers: lastFix.result!.events
          .filter((e) => e.clubId === game.managedClubId)
          .map((e) => `${game.world.players[e.scorerId]?.lastName ?? '?'} ${e.minute}'`),
      };
    }

    return { game, table, pos, row, club, form, last };
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
  const goToTable = useCallback(() => router.push('/season/table'), [router]);

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
          <View style={styles.appCrest}>
            <Text style={styles.appCrestText}>FB</Text>
          </View>
          <Text style={styles.kicker}>FOOTBALL MANAGER</Text>
          <Text style={styles.title}>FB SIMULATION</Text>
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

  const { game, club, pos, row, form, last } = summary;
  const nextMd = game.season.currentMatchday;
  const league = game.world.leagues[club.leagueId];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* top bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.appCrestSm}>
              <Text style={styles.appCrestSmText}>FB</Text>
            </View>
            <Text style={styles.brandWord}>FB SIMULATION</Text>
          </View>
          <Pressable onPress={goToSettings} style={styles.gearBtn} testID="home-settings">
            <Text style={styles.gearGlyph}>⚙</Text>
          </Pressable>
        </View>

        {/* Continue hero card */}
        <View style={styles.heroCard}>
          <View style={styles.clubRow}>
            <Crest code={club.shortName} color={club.primaryColor} />
            <View style={styles.clubRowText}>
              <Text style={styles.clubName} numberOfLines={1}>
                {club.name}
              </Text>
              <Text style={styles.clubMeta}>
                Season {game.season.number} · {league.name}
              </Text>
            </View>
            <View style={styles.posPill}>
              <Text style={styles.posPillText}>
                {pos > 0 ? ordinal(pos).toUpperCase() : '–'} · {row?.points ?? 0} PTS
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Last result */}
          {last ? (
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>LAST RESULT</Text>
                <Text style={styles.sectionMeta}>Matchday {last.matchday}</Text>
              </View>
              <View style={styles.scoreRow}>
                <View style={[styles.scoreSide, styles.scoreSideEnd]}>
                  <Text style={styles.scoreClub}>{club.shortName}</Text>
                  <Crest code={club.shortName} color={club.primaryColor} size={26} />
                </View>
                <View style={styles.scoreNums}>
                  <Text style={[styles.scoreNum, last.us > last.them && styles.scoreWin]}>{last.us}</Text>
                  <Text style={styles.scoreDash}>–</Text>
                  <Text style={[styles.scoreNum, last.them > last.us && styles.scoreWin]}>{last.them}</Text>
                </View>
                <View style={[styles.scoreSide, styles.scoreSideStart]}>
                  <Crest code={last.opp.shortName} color={last.opp.primaryColor} size={26} />
                  <Text style={[styles.scoreClub, styles.scoreClubOpp]}>{last.opp.shortName}</Text>
                </View>
              </View>
              {last.scorers.length > 0 && <Text style={styles.scorers}>{last.scorers.join(' · ')}</Text>}
            </View>
          ) : (
            <Text style={styles.sectionMeta}>No matches played yet this season.</Text>
          )}

          {/* Form */}
          {form.length > 0 && (
            <View style={styles.formRow}>
              <Text style={[styles.sectionLabel, styles.formLabel]}>FORM</Text>
              {form.map((f) => (
                <View key={f.id} style={[styles.formPill, { backgroundColor: outcomeColor(f.o, theme) }]}>
                  <Text style={[styles.formPillText, f.o === 'L' && styles.formPillTextLoss]}>{f.o}</Text>
                </View>
              ))}
            </View>
          )}

          <Button label={`Continue · Matchday ${nextMd}`} onPress={goToSeason} testID="home-continue" />
        </View>

        {/* League table peek (top 4, user highlighted) */}
        <View style={styles.tableCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>{league.name.toUpperCase()}</Text>
            <Pressable onPress={goToTable}>
              <Text style={styles.sectionMeta}>Table ›</Text>
            </Pressable>
          </View>
          {summary.table.slice(0, 4).map((r, i) => {
            const c = game.world.clubs[r.clubId];
            const isMine = r.clubId === game.managedClubId;
            return (
              <View key={r.clubId} style={[styles.tableRow, isMine && styles.tableRowMine]}>
                <Text style={[styles.tablePos, isMine && styles.accentText]}>{i + 1}</Text>
                <Crest code={c.shortName} color={c.primaryColor} size={20} />
                <Text style={[styles.tableName, isMine && styles.tableNameMine]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[styles.tablePts, isMine && styles.accentText]}>{r.points}</Text>
              </View>
            );
          })}
        </View>

        {/* Secondary actions */}
        <View style={styles.actionRow}>
          <Button label="New Game" variant="secondary" onPress={startNewGame} style={styles.actionBtn} testID="home-new-game" />
          <Button label="Settings" variant="ghost" onPress={goToSettings} style={styles.actionBtn} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => {
  const s = theme.spacing;
  // Gold-tint emphasis surfaces, derived from the theme accent so they re-skin per theme.
  const accentFill = `${theme.colors.accent}1F`; // ~12%
  const accentBorder = `${theme.colors.accent}4D`; // ~30%
  const accentRowFill = `${theme.colors.accent}12`; // ~7%

  return StyleSheet.create({
    center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: s(2), gap: s(1.75), paddingBottom: s(4) },

    // empty / first-run
    emptyContainer: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      paddingHorizontal: s(3),
      paddingVertical: s(4),
      justifyContent: 'space-between',
    },
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(1.25) },
    appCrest: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appCrestText: { color: theme.colors.accent, fontSize: 32, fontWeight: '800' },
    kicker: { color: theme.colors.accent, fontSize: 13, letterSpacing: 4, fontWeight: '600' },
    title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '800', letterSpacing: 0.5 },
    subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', paddingHorizontal: s(2) },
    menu: { gap: s(1.5) },
    footer: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', marginTop: s(2) },

    // top bar
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: s(0.5) },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: s(1.25) },
    appCrestSm: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appCrestSmText: { color: theme.colors.accent, fontSize: 13, fontWeight: '800' },
    brandWord: { color: theme.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
    gearBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearGlyph: { color: theme.colors.textMuted, fontSize: 17 },

    // hero card
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: s(2),
      gap: s(1.75),
    },
    clubRow: { flexDirection: 'row', alignItems: 'center', gap: s(1.5) },
    clubRowText: { flex: 1 },
    clubName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
    clubMeta: { color: theme.colors.textMuted, fontSize: theme.font.small },
    posPill: {
      backgroundColor: accentFill,
      borderWidth: 1,
      borderColor: accentBorder,
      borderRadius: theme.radius.pill,
      paddingHorizontal: s(1.25),
      paddingVertical: s(0.6),
    },
    posPillText: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
    divider: { height: 1, backgroundColor: theme.colors.border },

    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(1) },
    sectionLabel: { color: theme.colors.textMuted, fontSize: 12, letterSpacing: 2, fontWeight: '600' },
    sectionMeta: { color: theme.colors.textMuted, fontSize: 12 },

    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(1.5) },
    scoreSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(1) },
    scoreSideEnd: { justifyContent: 'flex-end' },
    scoreSideStart: { justifyContent: 'flex-start' },
    scoreClub: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
    scoreClubOpp: { color: theme.colors.textMuted },
    scoreNums: { flexDirection: 'row', alignItems: 'center', gap: s(1) },
    scoreNum: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
    scoreWin: { color: theme.colors.win },
    scoreDash: { color: theme.colors.textMuted, fontSize: 18 },
    scorers: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: s(1) },

    formRow: { flexDirection: 'row', alignItems: 'center', gap: s(1) },
    formLabel: { marginRight: 4 },
    formPill: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    formPillText: { color: theme.colors.bg, fontSize: 13, fontWeight: '800' },
    formPillTextLoss: { color: '#fff' },

    // table peek
    tableCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: s(2),
      gap: s(0.5),
    },
    tableRow: { flexDirection: 'row', alignItems: 'center', gap: s(1.5), paddingVertical: s(1) },
    tableRowMine: {
      backgroundColor: accentRowFill,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
      marginHorizontal: -s(2),
      paddingLeft: s(2) - 3,
      paddingRight: s(2),
      borderRadius: 4,
    },
    tablePos: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700', width: 18 },
    tableName: { flex: 1, color: theme.colors.text, fontSize: 14 },
    tableNameMine: { fontWeight: '700' },
    tablePts: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    accentText: { color: theme.colors.accent },

    actionRow: { flexDirection: 'row', gap: s(1.5) },
    actionBtn: { flex: 1 },
  });
};
