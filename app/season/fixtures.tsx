import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { isSeasonComplete, leagueTable, type Fixture } from '../../src/engine';
import { useGame, useGameStore } from '../../src/store/gameStore';
import { confirmAction } from '../../src/ui/confirm';
import { theme } from '../../src/theme';

function resultColor(my: number, opp: number): string {
  if (my > opp) return theme.colors.win;
  if (my < opp) return theme.colors.loss;
  return theme.colors.draw;
}

export default function FixturesScreen() {
  const router = useRouter();
  const game = useGame();
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const advanceToNextSeason = useGameStore((s) => s.advanceToNextSeason);

  if (!game) return <Redirect href="/" />;
  const me = game.managedClubId;
  const complete = isSeasonComplete(game);
  const userFixtures = game.season.fixtures.filter((f) => f.homeClubId === me || f.awayClubId === me);

  const onPlay = () => {
    const outcome = playNextMatchday();
    if (outcome?.userResult) router.push('/match');
  };

  const onAdvance = () => {
    const table = leagueTable(game);
    const champ = game.world.clubs[table[0].clubId];
    confirmAction({
      title: `Season ${game.season.number} complete`,
      message: `Champions: ${champ.name}. Start season ${game.season.number + 1}?`,
      confirmLabel: 'Start',
      cancelLabel: 'Not yet',
      onConfirm: () => advanceToNextSeason(),
    });
  };

  const champion = complete ? game.world.clubs[leagueTable(game)[0].clubId] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {complete ? (
        <Card style={styles.playCard}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.completeTitle}>Season {game.season.number} complete</Text>
          <Text style={styles.championText}>
            Champions: <Text style={{ fontWeight: '800' }}>{champion?.name}</Text>
            {champion?.id === me ? ' — that’s you!' : ''}
          </Text>
          <Button label={`Start season ${game.season.number + 1}`} onPress={onAdvance} style={styles.mt} testID="advance-season" />
        </Card>
      ) : (
        <Card style={styles.playCard}>
          <Text style={styles.matchdayLabel}>
            Matchday {game.season.currentMatchday} of {game.season.totalMatchdays}
          </Text>
          <NextOpponent game={game} />
          <Button label="Play next match" onPress={onPlay} style={styles.mt} testID="play-match" />
        </Card>
      )}

      <Button
        label="📅  Open calendar"
        variant="secondary"
        onPress={() => router.push('/calendar')}
        testID="open-calendar"
      />

      <Text style={styles.sectionTitle}>Your season</Text>
      {userFixtures.map((f) => (
        <FixtureRow key={f.id} fixture={f} me={me} game={game} />
      ))}
    </ScrollView>
  );
}

function opponentOf(f: Fixture, me: string) {
  const isHome = f.homeClubId === me;
  return { oppId: isHome ? f.awayClubId : f.homeClubId, isHome };
}

function NextOpponent({ game }: Readonly<{ game: NonNullable<ReturnType<typeof useGame>> }>) {
  const me = game.managedClubId;
  const next = game.season.fixtures.find(
    (f) => !f.result && (f.homeClubId === me || f.awayClubId === me),
  );
  if (!next) return null;
  const { oppId, isHome } = opponentOf(next, me);
  const opp = game.world.clubs[oppId];
  return (
    <View style={styles.nextRow}>
      <Text style={styles.nextLabel}>{isHome ? 'vs' : 'away to'}</Text>
      <Chip label={opp.shortName} color={opp.primaryColor} />
      <Text style={styles.nextName}>{opp.name}</Text>
    </View>
  );
}

function FixtureRow({
  fixture,
  me,
  game,
}: Readonly<{
  fixture: Fixture;
  me: string;
  game: NonNullable<ReturnType<typeof useGame>>;
}>) {
  const { oppId, isHome } = opponentOf(fixture, me);
  const opp = game.world.clubs[oppId];
  const r = fixture.result;
  let resultText = isHome ? 'vs' : '@';
  let color: string = theme.colors.textMuted;
  if (r) {
    const myGoals = isHome ? r.homeGoals : r.awayGoals;
    const oppGoals = isHome ? r.awayGoals : r.homeGoals;
    resultText = `${myGoals}-${oppGoals}`;
    color = resultColor(myGoals, oppGoals);
  }
  return (
    <View style={styles.fixtureRow}>
      <Text style={styles.md}>{fixture.matchday}</Text>
      <Text style={[styles.result, { color }]}>{resultText}</Text>
      <Chip label={opp.shortName} color={opp.primaryColor} />
      <Text style={styles.oppName} numberOfLines={1}>
        {opp.name}
      </Text>
      <Text style={styles.venue}>{isHome ? 'H' : 'A'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1), paddingBottom: theme.spacing(4) },
  playCard: { alignItems: 'center', gap: theme.spacing(0.5), paddingVertical: theme.spacing(2.5) },
  matchdayLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1), marginTop: theme.spacing(0.5) },
  nextLabel: { color: theme.colors.textMuted, fontSize: theme.font.body },
  nextName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  mt: { marginTop: theme.spacing(1.5), alignSelf: 'stretch' },
  trophy: { fontSize: 44 },
  completeTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800' },
  championText: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing(1.5),
  },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(1),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  md: { color: theme.colors.textMuted, fontSize: theme.font.small, minWidth: 20 },
  result: { fontSize: theme.font.body, fontWeight: '800', minWidth: 36 },
  oppName: { color: theme.colors.text, fontSize: theme.font.body, flex: 1 },
  venue: { color: theme.colors.textMuted, fontSize: theme.font.small, minWidth: 16, textAlign: 'center' },
});
