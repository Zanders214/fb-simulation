import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Meta } from '../src/components/Meta';
import { RecordTable } from '../src/components/RecordTable';
import { Section } from '../src/components/Section';
import { StatLine } from '../src/components/StatLine';
import { clubRecords } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { formatMoney, ordinal } from '../src/ui/format';
import { useThemedStyles, type Theme } from '../src/theme';

export default function ClubScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clubId = id ?? game?.managedClubId;
  const stats = useMemo(() => (game && clubId ? clubRecords(game, clubId) : null), [game, clubId]);

  if (!game || !clubId || !stats || !game.world.clubs[clubId]) return <Redirect href="/" />;
  const club = game.world.clubs[clubId];
  const openPlayer = (pid: string) => router.push(`/player?id=${pid}`);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Chip label={club.shortName} color={club.primaryColor} />
          <Text style={styles.clubName} numberOfLines={1}>
            {club.name}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Meta label="Trophies" value={`${stats.trophies}`} />
          <Meta label="Seasons" value={`${stats.seasonsPlayed}`} />
          <Meta label="Best finish" value={stats.bestFinish > 0 ? ordinal(stats.bestFinish) : '–'} />
        </View>
      </Card>

      <Section title="Squad value">
        <Card style={styles.card}>
          <StatLine label="Current" value={formatMoney(stats.squadValue)} />
          <StatLine label="Highest ever" value={formatMoney(stats.peakSquadValue)} />
        </Card>
      </Section>

      <RecordTable title="All-time Top Scorers" statLabel="G" entries={stats.topScorers} onPressRow={openPlayer} />
      <RecordTable title="All-time Top Assisters" statLabel="A" entries={stats.topAssisters} onPressRow={openPlayer} />
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  clubName: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { gap: theme.spacing(1.25) },
});
