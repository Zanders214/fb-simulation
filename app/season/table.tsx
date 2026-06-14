import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../src/components/Chip';
import { RecordTable } from '../../src/components/RecordTable';
import { leagueRecords, leagueTable, PYRAMID } from '../../src/engine';
import { useGame } from '../../src/store/gameStore';
import { useThemedStyles, type Theme } from '../../src/theme';

export default function TableScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const [showRecords, setShowRecords] = useState(false);
  const records = useMemo(() => (game ? leagueRecords(game, 5) : null), [game]);
  if (!game || !records) return <Redirect href="/" />;
  const rows = leagueTable(game);
  const openPlayer = (id: string) => router.push(`/player?id=${id}`);

  // Highlight the promotion (top) and relegation (bottom) bands, but only where a
  // tier actually exists above / below in this country's pyramid.
  const league = game.world.leagues[game.season.leagueId];
  const country = game.world.countries[league.countryId];
  const tierIdx = country ? country.leagueIds.indexOf(league.id) : 0;
  const hasAbove = tierIdx > 0;
  const hasBelow = country ? tierIdx < country.leagueIds.length - 1 : false;
  const slots = PYRAMID.PROMOTION_SLOTS;

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
        const promo = hasAbove && i < slots;
        const releg = hasBelow && i >= rows.length - slots;
        return (
          <Pressable
            key={r.clubId}
            onPress={() => router.push(`/club?id=${r.clubId}`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, isUser && styles.userRow, pressed && styles.rowPressed]}
          >
            <Text style={[styles.pos, styles.cell, promo && styles.posPromo, releg && styles.posReleg]}>{i + 1}</Text>
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
          </Pressable>
        );
      })}

      {(hasAbove || hasBelow) && (
        <View style={styles.legend}>
          {hasAbove && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotPromo]} />
              <Text style={styles.legendText}>Promotion</Text>
            </View>
          )}
          {hasBelow && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotReleg]} />
              <Text style={styles.legendText}>Relegation</Text>
            </View>
          )}
        </View>
      )}

      <Pressable
        onPress={() => setShowRecords((v) => !v)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.recordsBtn, pressed && styles.recordsBtnPressed]}
      >
        <Text style={styles.recordsBtnText}>{showRecords ? 'Hide Records ▲' : 'Records ▼'}</Text>
      </Pressable>

      {showRecords && (
        <View style={styles.recordsSection}>
          <RecordTable title="Top Scorers" statLabel="G" entries={records.topScorers} highlightClubId={game.managedClubId} onPressRow={openPlayer} />
          <RecordTable title="Top Assisters" statLabel="A" entries={records.topAssisters} highlightClubId={game.managedClubId} onPressRow={openPlayer} />
          <RecordTable title="Top Goalkeepers" statLabel="CS" entries={records.topGoalkeepers} highlightClubId={game.managedClubId} onPressRow={openPlayer} />
          <RecordTable title="Most Cards" statLabel="Cards" entries={records.mostCards} highlightClubId={game.managedClubId} onPressRow={openPlayer} />
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
  rowPressed: { opacity: 0.6 },
  cell: { color: theme.colors.text, fontSize: theme.font.small },
  userText: { fontWeight: '800' },
  pos: { width: 22, textAlign: 'center' },
  posPromo: { color: theme.colors.win, fontWeight: '800' },
  posReleg: { color: theme.colors.loss, fontWeight: '800' },
  club: { flex: 1 },
  clubCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  clubName: { color: theme.colors.text, fontSize: theme.font.small, flex: 1 },
  num: { width: 26, textAlign: 'center' },
  pts: { width: 34, textAlign: 'center', fontWeight: '800' },
  ptsVal: { color: theme.colors.accent },

  // promotion / relegation legend
  legend: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(1.5), paddingHorizontal: theme.spacing(0.5) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.75) },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendDotPromo: { backgroundColor: theme.colors.win },
  legendDotReleg: { backgroundColor: theme.colors.loss },
  legendText: { color: theme.colors.textMuted, fontSize: theme.font.small },

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
