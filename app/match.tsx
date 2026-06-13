import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import type { MatchResult } from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { goalTypeTag } from '../src/ui/format';
import { theme } from '../src/theme';

export default function MatchScreen() {
  const router = useRouter();
  const game = useGame();
  const lastOutcome = useGameStore((s) => s.lastOutcome);

  if (!game || !lastOutcome?.userResult) return <Redirect href="/season" />;
  const me = game.managedClubId;
  const r = lastOutcome.userResult;
  const home = game.world.clubs[r.homeClubId];
  const away = game.world.clubs[r.awayClubId];

  const isHome = r.homeClubId === me;
  const myGoals = isHome ? r.homeGoals : r.awayGoals;
  const oppGoals = isHome ? r.awayGoals : r.homeGoals;
  const outcome = myGoals > oppGoals ? 'WIN' : myGoals < oppGoals ? 'DEFEAT' : 'DRAW';
  const outcomeColor =
    outcome === 'WIN' ? theme.colors.win : outcome === 'DEFEAT' ? theme.colors.loss : theme.colors.draw;

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

      <Text style={styles.sectionTitle}>Goals</Text>
      <Card style={styles.goalsCard}>
        {r.events.length === 0 ? (
          <Text style={styles.noGoals}>No goals.</Text>
        ) : (
          r.events.map((e, i) => {
            const club = game.world.clubs[e.clubId];
            const scorer = game.world.players[e.scorerId];
            const assist = e.assistId ? game.world.players[e.assistId] : undefined;
            return (
              <View key={i} style={styles.goalRow}>
                <Text style={styles.minute}>{e.minute}'</Text>
                <Chip label={club.shortName} color={club.primaryColor} />
                <View style={styles.goalInfo}>
                  <Text style={styles.scorer}>
                    {scorer?.name ?? 'Unknown'}
                    <Text style={styles.tag}>{goalTypeTag(e.type)}</Text>
                  </Text>
                  {assist && <Text style={styles.assist}>assist: {assist.name}</Text>}
                </View>
              </View>
            );
          })
        )}
      </Card>

      {others.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Elsewhere this matchday</Text>
          <Card style={styles.othersCard}>
            {others.map((res, i) => (
              <OtherResult key={i} res={res} game={game} />
            ))}
          </Card>
        </>
      )}

      <Button label="Continue" onPress={() => router.back()} style={styles.continue} testID="match-continue" />
    </ScrollView>
  );
}

function OtherResult({ res, game }: { res: MatchResult; game: NonNullable<ReturnType<typeof useGame>> }) {
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

const styles = StyleSheet.create({
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
  goalsCard: { gap: theme.spacing(1) },
  noGoals: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.25) },
  minute: { color: theme.colors.textMuted, fontSize: theme.font.small, minWidth: 28, fontWeight: '700' },
  goalInfo: { flex: 1 },
  scorer: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
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
