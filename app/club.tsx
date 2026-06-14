import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { RecordTable } from '../src/components/RecordTable';
import { clubRecords } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { userClub } from '../src/store/selectors';
import { formatMoney, ordinal } from '../src/ui/format';
import { useThemedStyles, type Theme } from '../src/theme';

export default function ClubScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const stats = useMemo(() => (game ? clubRecords(game) : null), [game]);

  if (!game || !stats) return <Redirect href="/" />;
  const club = userClub(game);
  const openPlayer = (id: string) => router.push(`/player?id=${id}`);

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Squad value</Text>
        <Card style={styles.card}>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{formatMoney(stats.squadValue)}</Text>
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>Highest ever</Text>
            <Text style={styles.statValue}>{formatMoney(stats.peakSquadValue)}</Text>
          </View>
        </Card>
      </View>

      <RecordTable title="All-time Top Scorers" statLabel="G" entries={stats.topScorers} onPressRow={openPlayer} />
      <RecordTable title="All-time Top Assisters" statLabel="A" entries={stats.topAssisters} onPressRow={openPlayer} />
    </ScrollView>
  );
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.meta}>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  clubName: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { alignItems: 'center', flex: 1 },
  metaValue: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  metaLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
  section: { gap: theme.spacing(0.75) },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: theme.spacing(0.5),
  },
  card: { gap: theme.spacing(1.25) },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.font.body },
  statValue: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
});
