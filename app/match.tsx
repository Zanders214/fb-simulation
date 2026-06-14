import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import type { GoalEvent, MatchResult } from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { formatMoney, goalTypeTag } from '../src/ui/format';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

type Outcome = 'WIN' | 'DRAW' | 'DEFEAT';

function matchOutcome(my: number, opp: number): Outcome {
  if (my > opp) return 'WIN';
  if (my < opp) return 'DEFEAT';
  return 'DRAW';
}

function outcomeColorFor(outcome: Outcome, theme: Theme): string {
  if (outcome === 'WIN') return theme.colors.win;
  if (outcome === 'DEFEAT') return theme.colors.loss;
  return theme.colors.draw;
}

export default function MatchScreen() {
  const router = useRouter();
  const game = useGame();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lastOutcome = useGameStore((s) => s.lastOutcome);

  if (!game || !lastOutcome?.userResult) return <Redirect href="/season" />;
  const me = game.managedClubId;
  const r = lastOutcome.userResult;
  const home = game.world.clubs[r.homeClubId];
  const away = game.world.clubs[r.awayClubId];

  const isHome = r.homeClubId === me;
  const myGoals = isHome ? r.homeGoals : r.awayGoals;
  const oppGoals = isHome ? r.awayGoals : r.homeGoals;
  const outcome = matchOutcome(myGoals, oppGoals);
  const outcomeColor = outcomeColorFor(outcome, theme);

  const others = lastOutcome.results.filter((res) => res !== r);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.outcome, { color: outcomeColor }]}>{outcome}</Text>

      <Card style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={styles.team}>
            <Chip label={home.shortName} color={home.primaryColor} />
            <Text style={styles.teamName} numberOfLines={1}>{home.name}</Text>
          </View>
          <Text style={styles.score}>{r.homeGoals} - {r.awayGoals}</Text>
          <View style={[styles.team, styles.teamRight]}>
            <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={1}>{away.name}</Text>
            <Chip label={away.shortName} color={away.primaryColor} />
          </View>
        </View>
      </Card>

      {lastOutcome.userEarnings != null && (
        <Text style={[styles.earnings, { color: outcomeColor }]}>
          Match fee +{formatMoney(lastOutcome.userEarnings)}
        </Text>
      )}

      <Card style={styles.timelineCard}>
        {r.events.length === 0 ? (
          <Text style={styles.noGoals}>No goals.</Text>
        ) : (
          <>
            <View style={styles.spine} />
            {r.events.map((e) => (
              <GoalEntry
                key={`${e.minute}-${e.scorerId}-${e.type}`}
                event={e}
                isHome={e.clubId === r.homeClubId}
                game={game}
              />
            ))}
          </>
        )}
      </Card>

      {others.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Elsewhere this matchday</Text>
          <Card style={styles.othersCard}>
            {others.map((res) => (
              <OtherResult key={`${res.homeClubId}-${res.awayClubId}`} res={res} game={game} />
            ))}
          </Card>
        </>
      )}

      <Button label="Continue" onPress={() => router.back()} style={styles.continue} testID="match-continue" />
    </ScrollView>
  );
}

function GoalEntry({
  event,
  isHome,
  game,
}: Readonly<{
  event: GoalEvent;
  isHome: boolean;
  game: NonNullable<ReturnType<typeof useGame>>;
}>) {
  const styles = useThemedStyles(makeStyles);
  const scorer = game.world.players[event.scorerId];
  const assist = event.assistId ? game.world.players[event.assistId] : undefined;

  const info = (
    <View style={[styles.goalInfo, isHome ? styles.goalInfoHome : styles.goalInfoAway]}>
      <Text style={[styles.scorer, isHome ? styles.alignEnd : styles.alignStart]} numberOfLines={1}>
        {scorer?.name ?? 'Unknown'}
        <Text style={styles.tag}>{goalTypeTag(event.type)}</Text>
      </Text>
      {assist && (
        <Text style={[styles.assist, isHome ? styles.alignEnd : styles.alignStart]} numberOfLines={1}>
          assist: {assist.name}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineSide}>{isHome ? info : null}</View>
      <View style={styles.timelineCenter}>
        {isHome && <Text style={styles.ball}>⚽</Text>}
        <Text style={styles.minute}>{`${event.minute}'`}</Text>
        {!isHome && <Text style={styles.ball}>⚽</Text>}
      </View>
      <View style={styles.timelineSide}>{isHome ? null : info}</View>
    </View>
  );
}

function OtherResult({ res, game }: Readonly<{ res: MatchResult; game: NonNullable<ReturnType<typeof useGame>> }>) {
  const styles = useThemedStyles(makeStyles);
  const h = game.world.clubs[res.homeClubId];
  const a = game.world.clubs[res.awayClubId];
  return (
    <View style={styles.otherRow}>
      <Text style={[styles.otherName, styles.otherHome]} numberOfLines={1}>{h.shortName}</Text>
      <Text style={styles.otherScore}>{res.homeGoals}-{res.awayGoals}</Text>
      <Text style={[styles.otherName, styles.otherAway]} numberOfLines={1}>{a.shortName}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1), paddingBottom: theme.spacing(4) },
  outcome: { fontSize: theme.font.heading, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginTop: theme.spacing(1) },
  scoreCard: { paddingVertical: theme.spacing(2) },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  team: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  teamRight: { justifyContent: 'flex-end' },
  teamName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600', flexShrink: 1 },
  teamNameRight: { textAlign: 'right' },
  score: { color: theme.colors.text, fontSize: 30, fontWeight: '900', paddingHorizontal: theme.spacing(1.5) },
  sectionTitle: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing(1) },
  timelineCard: { paddingVertical: theme.spacing(1.5), gap: theme.spacing(1.25) },
  noGoals: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
  spine: {
    position: 'absolute',
    top: theme.spacing(1.5),
    bottom: theme.spacing(1.5),
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: theme.colors.border,
  },
  earnings: { textAlign: 'center', fontSize: theme.font.body, fontWeight: '800', letterSpacing: 0.5 },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
  timelineSide: { flex: 1 },
  timelineCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(0.5), minWidth: 64 },
  ball: { fontSize: 12 },
  minute: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  goalInfo: { flexShrink: 1 },
  goalInfoHome: { alignItems: 'flex-end', paddingRight: theme.spacing(1) },
  goalInfoAway: { alignItems: 'flex-start', paddingLeft: theme.spacing(1) },
  scorer: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  alignEnd: { textAlign: 'right' },
  alignStart: { textAlign: 'left' },
  tag: { color: theme.colors.textMuted, fontWeight: '400', fontSize: theme.font.small },
  assist: { color: theme.colors.textMuted, fontSize: theme.font.small },
  othersCard: { gap: theme.spacing(0.75) },
  otherRow: { flexDirection: 'row', alignItems: 'center' },
  otherName: { color: theme.colors.text, fontSize: theme.font.small, flex: 1 },
  otherHome: { textAlign: 'right' },
  otherAway: { textAlign: 'left' },
  otherScore: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800', paddingHorizontal: theme.spacing(1.5) },
  continue: { marginTop: theme.spacing(2) },
});
