import { Redirect } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { CalendarGrid, type DayMarker } from '../src/components/CalendarGrid';
import {
  addDays,
  addMonths,
  currentDate,
  dateKey,
  dateToTargetMatchday,
  diffDays,
  enumerateSchedule,
  formatMonthYear,
  formatShortDate,
  isSeasonComplete,
  seasonEndDate,
  seasonStartDate,
  startOfMonth,
  type Fixture,
  type GameState,
} from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';
import { confirmAction } from '../src/ui/confirm';

const INTERVAL_MS = 110;
const TARGET_FRAMES = 28; // a jump of any length sweeps in roughly this many ticks

function resultStyle(my: number, og: number, theme: Theme): { resultLetter: string; resultColor: string } {
  if (my > og) return { resultLetter: 'W', resultColor: theme.colors.win };
  if (my < og) return { resultLetter: 'L', resultColor: theme.colors.loss };
  return { resultLetter: 'D', resultColor: theme.colors.draw };
}

/** Build the calendar marker for the user's fixture on a given day (null if none). */
function userFixtureMarker(game: GameState, fixtures: Fixture[], me: string, theme: Theme): DayMarker | null {
  const f = fixtures.find((fx) => fx.homeClubId === me || fx.awayClubId === me);
  if (!f) return null;
  const isHome = f.homeClubId === me;
  const opp = game.world.clubs[isHome ? f.awayClubId : f.homeClubId];
  const marker: DayMarker = { isUserMatch: true, oppShortName: opp.shortName, oppColor: opp.primaryColor };
  if (f.result) {
    const my = isHome ? f.result.homeGoals : f.result.awayGoals;
    const og = isHome ? f.result.awayGoals : f.result.homeGoals;
    marker.played = true;
    marker.resultText = `${my}-${og}`;
    Object.assign(marker, resultStyle(my, og, theme));
  }
  return marker;
}

export default function CalendarScreen() {
  const game = useGame();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const simulateToDate = useGameStore((s) => s.simulateToDate);

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(game ? currentDate(game) : new Date()),
  );
  const [revealUpTo, setRevealUpTo] = useState(() => (game ? currentDate(game) : new Date()));
  const [animating, setAnimating] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealRef = useRef(revealUpTo);
  const toRef = useRef<Date | null>(null);

  // Stop the sweep if the screen unmounts mid-animation.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Only the user's matches are marked; every other passed day just gets an ✕.
  const markers = useMemo(() => {
    const map = new Map<string, DayMarker>();
    if (!game) return map;
    const me = game.managedClubId;
    for (const { date, fixtures } of enumerateSchedule(game)) {
      const marker = userFixtureMarker(game, fixtures, me, theme);
      if (marker) map.set(dateKey(date), marker);
    }
    return map;
  }, [game, theme]);

  if (!game) return <Redirect href="/" />;

  const complete = isSeasonComplete(game);
  const minMonth = startOfMonth(seasonStartDate(game));
  const maxMonth = startOfMonth(seasonEndDate(game));
  const canPrev = !animating && viewMonth.getTime() > minMonth.getTime();
  const canNext = !animating && viewMonth.getTime() < maxMonth.getTime();

  const canSelect = (day: Date): boolean => !animating && dateToTargetMatchday(game, day) != null;

  const runJump = (day: Date) => {
    const before = useGameStore.getState().game;
    if (!before) return;
    const from = currentDate(before);
    const played = simulateToDate(day);
    if (played <= 0) return;
    const after = useGameStore.getState().game;
    if (!after) return;
    const to = currentDate(after);

    toRef.current = to;
    revealRef.current = from;
    setRevealUpTo(from);
    setViewMonth(startOfMonth(from));
    setAnimating(true);

    const stepDays = Math.max(1, Math.ceil(Math.max(1, diffDays(from, to)) / TARGET_FRAMES));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const prev = revealRef.current;
      const next = new Date(Math.min(addDays(prev, stepDays).getTime(), to.getTime()));
      revealRef.current = next;
      setRevealUpTo(next);
      if (next.getUTCMonth() !== prev.getUTCMonth() || next.getUTCFullYear() !== prev.getUTCFullYear()) {
        setViewMonth(startOfMonth(next));
      }
      if (next.getTime() >= to.getTime()) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setAnimating(false);
      }
    }, INTERVAL_MS);
  };

  const skip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const to = toRef.current;
    if (to) {
      revealRef.current = to;
      setRevealUpTo(to);
      setViewMonth(startOfMonth(to));
    }
    setAnimating(false);
  };

  const onSelectDay = (day: Date) => {
    const target = dateToTargetMatchday(game, day);
    if (target == null) return;
    const count = target - game.season.currentMatchday + 1;
    confirmAction({
      title: 'Simulate ahead?',
      message: `Play through to ${formatShortDate(day)} — ${count} match${count === 1 ? '' : 'es'}.`,
      confirmLabel: 'Simulate',
      onConfirm: () => runJump(day),
    });
  };

  let hint: string;
  if (animating) hint = 'Simulating…';
  else if (complete) hint = 'Season complete — advance from the Fixtures tab.';
  else hint = 'Tap a future date to simulate to it.';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.statusCard}>
        <Text style={styles.statusLabel}>
          Season {game.season.number} · {complete ? 'Complete' : `Matchday ${game.season.currentMatchday} of ${game.season.totalMatchdays}`}
        </Text>
        <Text style={styles.today}>{formatShortDate(currentDate(game))}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </Card>

      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={!canPrev}
          hitSlop={10}
          style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
        >
          <Text style={styles.navChevron}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthYear(viewMonth)}</Text>
        <Pressable
          onPress={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canNext}
          hitSlop={10}
          style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
        >
          <Text style={styles.navChevron}>›</Text>
        </Pressable>
      </View>

      <CalendarGrid
        month={viewMonth}
        asOf={revealUpTo}
        seasonStart={seasonStartDate(game)}
        markers={markers}
        onSelectDay={onSelectDay}
        canSelect={canSelect}
      />

      {animating ? (
        <Button label="Skip" variant="secondary" onPress={skip} style={styles.skip} testID="calendar-skip" />
      ) : (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Text style={styles.cross}>✕</Text>
            <Text style={styles.legendText}>day played</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: theme.colors.textMuted }]} />
            <Text style={styles.legendText}>your match</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={[styles.legendLetter, { color: theme.colors.win }]}>W</Text>
            <Text style={[styles.legendLetter, { color: theme.colors.draw }]}>D</Text>
            <Text style={[styles.legendLetter, { color: theme.colors.loss }]}>L</Text>
            <Text style={styles.legendText}>result</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  statusCard: { alignItems: 'center', gap: theme.spacing(0.25), paddingVertical: theme.spacing(2) },
  statusLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  today: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800' },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.spacing(0.5) },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navBtnDisabled: { opacity: 0.3 },
  navChevron: { color: theme.colors.text, fontSize: 24, fontWeight: '800', lineHeight: 26 },
  monthLabel: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800' },
  skip: { alignSelf: 'stretch' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(0.5),
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.5) },
  legendText: { color: theme.colors.textMuted, fontSize: theme.font.small },
  legendLetter: { fontSize: theme.font.small, fontWeight: '900' },
  cross: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
