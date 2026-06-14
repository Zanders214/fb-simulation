import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { clubRecords, type RecordEntry } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { userClub } from '../src/store/selectors';
import { formatMoney, ordinal, positionColor } from '../src/ui/format';
import { useThemedStyles, type Theme } from '../src/theme';

export default function ClubScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const stats = useMemo(() => (game ? clubRecords(game) : null), [game]);

  if (!game || !stats) return <Redirect href="/" />;
  const club = userClub(game);

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

      <RecordTable
        title="All-time Top Scorers"
        statLabel="G"
        entries={stats.topScorers}
        onPressRow={(id) => router.push(`/player?id=${id}`)}
      />
      <RecordTable
        title="All-time Top Assisters"
        statLabel="A"
        entries={stats.topAssisters}
        onPressRow={(id) => router.push(`/player?id=${id}`)}
      />
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

function RecordTable({
  title,
  statLabel,
  entries,
  onPressRow,
}: Readonly<{
  title: string;
  statLabel: string;
  entries: RecordEntry[];
  onPressRow: (playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <Text style={[styles.rPos, styles.hCell]}>#</Text>
          <Text style={[styles.rName, styles.hCell]}>Player</Text>
          <Text style={[styles.rPosTag, styles.hCell]}>Pos</Text>
          <Text style={[styles.rTeam, styles.hCell]}>Team</Text>
          <Text style={[styles.rStat, styles.hCell]}>{statLabel}</Text>
          <Text style={[styles.rValue, styles.hCell]}>Value</Text>
        </View>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No data yet — play some matches.</Text>
        ) : (
          entries.map((e, i) => (
            <Pressable
              key={e.player.id}
              onPress={() => onPressRow(e.player.id)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.recordRow, pressed && styles.rowPressed]}
            >
              <Text style={[styles.rPos, styles.cell]}>{i + 1}</Text>
              <Text style={[styles.rName, styles.cell]} numberOfLines={1}>
                {e.player.name}
              </Text>
              <View style={styles.rPosTag}>
                <Chip label={e.player.position} color={positionColor(e.player.position)} />
              </View>
              <View style={styles.rTeam}>
                {e.club ? <Chip label={e.club.shortName} color={e.club.primaryColor} /> : null}
              </View>
              <Text style={[styles.rStat, styles.cell, styles.statVal]}>{e.value}</Text>
              <Text style={[styles.rValue, styles.cell]}>{formatMoney(e.marketValue)}</Text>
            </Pressable>
          ))
        )}
      </Card>
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

  recordCard: { paddingVertical: theme.spacing(1) },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing(0.75),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.75),
    borderRadius: theme.radius.sm,
  },
  rowPressed: { opacity: 0.6 },
  hCell: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  cell: { color: theme.colors.text, fontSize: theme.font.small },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    paddingVertical: theme.spacing(1),
  },
  rPos: { width: 20, textAlign: 'center' },
  rName: { flex: 1, paddingRight: theme.spacing(0.5) },
  rPosTag: { width: 44, alignItems: 'center' },
  rTeam: { width: 48, alignItems: 'center' },
  rStat: { width: 30, textAlign: 'center' },
  rValue: { width: 60, textAlign: 'right' },
  statVal: { color: theme.colors.accent, fontWeight: '800' },
});
