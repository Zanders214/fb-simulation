import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../src/components/Chip';
import { leagueRecords, leagueTable, type RecordEntry } from '../../src/engine';
import { useGame } from '../../src/store/gameStore';
import { formatMoney, positionColor } from '../../src/ui/format';
import { theme } from '../../src/theme';

export default function TableScreen() {
  const game = useGame();
  const [showRecords, setShowRecords] = useState(false);
  const records = useMemo(() => (game ? leagueRecords(game, 5) : null), [game]);
  if (!game || !records) return <Redirect href="/" />;
  const rows = leagueTable(game);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.pos, styles.hCell]}>#</Text>
        <Text style={[styles.club, styles.hCell]}>Club</Text>
        <Text style={[styles.num, styles.hCell]}>P</Text>
        <Text style={[styles.num, styles.hCell]}>W</Text>
        <Text style={[styles.num, styles.hCell]}>D</Text>
        <Text style={[styles.num, styles.hCell]}>L</Text>
        <Text style={[styles.num, styles.hCell]}>GD</Text>
        <Text style={[styles.pts, styles.hCell]}>Pts</Text>
      </View>

      {rows.map((r, i) => {
        const club = game.world.clubs[r.clubId];
        const isUser = r.clubId === game.managedClubId;
        return (
          <View key={r.clubId} style={[styles.row, isUser && styles.userRow]}>
            <Text style={[styles.pos, styles.cell]}>{i + 1}</Text>
            <View style={styles.clubCell}>
              <Chip label={club.shortName} color={club.primaryColor} />
              <Text style={[styles.clubName, isUser && styles.userText]} numberOfLines={1}>
                {club.name}
              </Text>
            </View>
            <Text style={[styles.num, styles.cell]}>{r.played}</Text>
            <Text style={[styles.num, styles.cell]}>{r.won}</Text>
            <Text style={[styles.num, styles.cell]}>{r.drawn}</Text>
            <Text style={[styles.num, styles.cell]}>{r.lost}</Text>
            <Text style={[styles.num, styles.cell]}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Text>
            <Text style={[styles.pts, styles.cell, styles.ptsVal]}>{r.points}</Text>
          </View>
        );
      })}

      <Pressable
        onPress={() => setShowRecords((v) => !v)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.recordsBtn, pressed && styles.recordsBtnPressed]}
      >
        <Text style={styles.recordsBtnText}>{showRecords ? 'Hide Records ▲' : 'Records ▼'}</Text>
      </Pressable>

      {showRecords && (
        <View style={styles.recordsSection}>
          <RecordTable title="Top Scorers" statLabel="G" entries={records.topScorers} game={game} />
          <RecordTable title="Top Assisters" statLabel="A" entries={records.topAssisters} game={game} />
          <RecordTable title="Top Goalkeepers" statLabel="CS" entries={records.topGoalkeepers} game={game} />
        </View>
      )}
    </ScrollView>
  );
}

function RecordTable({
  title,
  statLabel,
  entries,
  game,
}: Readonly<{
  title: string;
  statLabel: string;
  entries: RecordEntry[];
  game: NonNullable<ReturnType<typeof useGame>>;
}>) {
  return (
    <View style={styles.recordTable}>
      <Text style={styles.recordTitle}>{title}</Text>
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
        entries.map((e, i) => {
          const isUser = e.club.id === game.managedClubId;
          return (
            <View key={e.player.id} style={[styles.recordRow, isUser && styles.userRow]}>
              <Text style={[styles.rPos, styles.cell]}>{i + 1}</Text>
              <Text style={[styles.rName, styles.cell, isUser && styles.userText]} numberOfLines={1}>
                {e.player.name}
              </Text>
              <View style={styles.rPosTag}>
                <Chip label={e.player.position} color={positionColor(e.player.position)} />
              </View>
              <View style={styles.rTeam}>
                <Chip label={e.club.shortName} color={e.club.primaryColor} />
              </View>
              <Text style={[styles.rStat, styles.cell, styles.statVal]}>{e.value}</Text>
              <Text style={[styles.rValue, styles.cell]}>{formatMoney(e.marketValue)}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  hCell: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userRow: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm },
  cell: { color: theme.colors.text, fontSize: theme.font.small },
  userText: { fontWeight: '800' },
  pos: { width: 22, textAlign: 'center' },
  club: { flex: 1 },
  clubCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  clubName: { color: theme.colors.text, fontSize: theme.font.small, flex: 1 },
  num: { width: 26, textAlign: 'center' },
  pts: { width: 34, textAlign: 'center', fontWeight: '800' },
  ptsVal: { color: theme.colors.accent },

  // records toggle + section
  recordsBtn: {
    marginTop: theme.spacing(2),
    paddingVertical: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  recordsBtnPressed: { opacity: 0.8 },
  recordsBtnText: { color: theme.colors.accent, fontSize: theme.font.body, fontWeight: '800' },
  recordsSection: { marginTop: theme.spacing(1.5), gap: theme.spacing(2) },
  recordTable: { gap: theme.spacing(0.25) },
  recordTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.5),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(0.5),
  },
  rPos: { width: 20, textAlign: 'center' },
  rName: { flex: 1, paddingRight: theme.spacing(0.5) },
  rPosTag: { width: 44, alignItems: 'center' },
  rTeam: { width: 48, alignItems: 'center' },
  rStat: { width: 30, textAlign: 'center' },
  rValue: { width: 60, textAlign: 'right' },
  statVal: { color: theme.colors.accent, fontWeight: '800' },
});
