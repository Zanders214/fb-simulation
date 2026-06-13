import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../src/components/Chip';
import { leagueTable } from '../../src/engine';
import { useGame } from '../../src/store/gameStore';
import { theme } from '../../src/theme';

export default function TableScreen() {
  const game = useGame();
  if (!game) return <Redirect href="/" />;
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
    </ScrollView>
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
});
