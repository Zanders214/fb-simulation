import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecordEntry } from '../engine';
import { formatMoney, positionColor } from '../ui/format';
import { useThemedStyles, type Theme } from '../theme';
import { Card } from './Card';
import { Chip } from './Chip';

/**
 * A ranked leaderboard of players (scorers, assisters, goalkeepers, …). Used by
 * both the league records on the Table tab and the all-time records on the Club
 * Stats screen. Pass `onPressRow` to make rows tappable, and `highlightClubId`
 * to emphasise the row(s) belonging to a particular club.
 */
export function RecordTable({
  title,
  statLabel,
  entries,
  highlightClubId,
  onPressRow,
}: Readonly<{
  title: string;
  statLabel: string;
  entries: RecordEntry[];
  highlightClubId?: string;
  onPressRow?: (playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Card style={styles.card}>
        <View style={styles.header}>
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
            <Row key={e.player.id} entry={e} rank={i + 1} highlightClubId={highlightClubId} onPress={onPressRow} />
          ))
        )}
      </Card>
    </View>
  );
}

function Row({
  entry,
  rank,
  highlightClubId,
  onPress,
}: Readonly<{
  entry: RecordEntry;
  rank: number;
  highlightClubId?: string;
  onPress?: (playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const isUser = highlightClubId != null && entry.club.id === highlightClubId;
  const body = (
    <>
      <Text style={[styles.rPos, styles.cell]}>{rank}</Text>
      <View style={styles.rName}>
        <Text style={[styles.cell, isUser && styles.userText]} numberOfLines={1}>
          {entry.player.name}
        </Text>
        {entry.yellow != null && (
          <Text style={styles.cardSplit} numberOfLines={1}>{`🟨 ${entry.yellow}   🟥 ${entry.red ?? 0}`}</Text>
        )}
      </View>
      <View style={styles.rPosTag}>
        <Chip label={entry.player.position} color={positionColor(entry.player.position)} />
      </View>
      <View style={styles.rTeam}>
        <Chip label={entry.club.shortName} color={entry.club.primaryColor} />
      </View>
      <Text style={[styles.rStat, styles.cell, styles.statVal]}>{entry.value}</Text>
      <Text style={[styles.rValue, styles.cell]}>{formatMoney(entry.marketValue)}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(entry.player.id)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, isUser && styles.userRow, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, isUser && styles.userRow]}>{body}</View>;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: { gap: theme.spacing(0.5) },
  card: { paddingHorizontal: theme.spacing(1.25), paddingVertical: theme.spacing(1), gap: theme.spacing(0.25) },
  title: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.5),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userRow: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm },
  pressed: { opacity: 0.6 },
  hCell: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  cell: { color: theme.colors.text, fontSize: theme.font.small },
  userText: { fontWeight: '800' },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(0.5),
  },
  rPos: { width: 20, textAlign: 'center' },
  rName: { flex: 1, paddingRight: theme.spacing(0.5) },
  cardSplit: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 1 },
  rPosTag: { width: 44, alignItems: 'center' },
  rTeam: { width: 48, alignItems: 'center' },
  rStat: { width: 30, textAlign: 'center' },
  rValue: { width: 60, textAlign: 'right' },
  statVal: { color: theme.colors.accent, fontWeight: '800' },
});
