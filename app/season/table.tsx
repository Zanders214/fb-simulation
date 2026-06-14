import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../src/components/Chip';
import { RecordTable } from '../../src/components/RecordTable';
import { leagueRecords, leagueTable } from '../../src/engine';
import { useGame } from '../../src/store/gameStore';
import { useThemedStyles, type Theme } from '../../src/theme';

export default function TableScreen() {
  const game = useGame();
  const styles = useThemedStyles(makeStyles);
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
          <RecordTable title="Top Scorers" statLabel="G" entries={records.topScorers} highlightClubId={game.managedClubId} />
          <RecordTable title="Top Assisters" statLabel="A" entries={records.topAssisters} highlightClubId={game.managedClubId} />
          <RecordTable title="Top Goalkeepers" statLabel="CS" entries={records.topGoalkeepers} highlightClubId={game.managedClubId} />
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
});
