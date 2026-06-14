import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { areaRating, overall, playerValue, type Area } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { formatMoney, overallColor, positionColor } from '../src/ui/format';
import { theme } from '../src/theme';

const POSITION_NAME: Record<string, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

const AREAS: { key: Area; label: string }[] = [
  { key: 'attacking', label: 'Attacking' },
  { key: 'midfield', label: 'Midfield' },
  { key: 'defending', label: 'Defending' },
];

export default function PlayerScreen() {
  const game = useGame();
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = game && id ? game.world.players[id] : undefined;

  if (!game || !player) return <Redirect href="/season" />;

  const ovr = overall(player);
  const club = game.world.clubs[player.clubId];
  const careerGoals = player.careerGoals ?? 0;
  const careerAssists = player.careerAssists ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Chip label={player.position} color={positionColor(player.position)} />
          <View style={styles.nameWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}
            </Text>
            {club ? (
              <Text style={styles.club} numberOfLines={1}>
                {club.name}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.ovr, { color: overallColor(ovr) }]}>{ovr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Meta label="Position" value={POSITION_NAME[player.position] ?? player.position} />
          <Meta label="Nationality" value={player.nationality} />
          <Meta label="Age" value={`${player.age}`} />
        </View>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attributes</Text>
        <Card style={styles.card}>
          {AREAS.map(({ key, label }) => (
            <StatBar key={key} label={label} value={Math.round(areaRating(player, key))} />
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Value</Text>
        <Card style={styles.card}>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>Market value</Text>
            <Text style={styles.statValue}>{formatMoney(playerValue(player))}</Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This season</Text>
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${player.seasonGoals}`} />
          <Stat label="Assists" value={`${player.seasonAssists}`} />
          <Stat label="Apps" value={`${player.seasonApps}`} />
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All time</Text>
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${careerGoals}`} />
          <Stat label="Assists" value={`${careerAssists}`} />
        </Card>
      </View>
    </ScrollView>
  );
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statBig}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function StatBar({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value}%`, backgroundColor: overallColor(value) }]} />
      </View>
      <Text style={[styles.barValue, { color: overallColor(value) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800' },
  club: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
  ovr: { fontSize: theme.font.title, fontWeight: '900' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { alignItems: 'center', flex: 1 },
  metaValue: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
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
  statGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statBig: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  barLabel: { color: theme.colors.text, fontSize: theme.font.small, width: 78 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: theme.radius.pill },
  barValue: { fontSize: theme.font.body, fontWeight: '800', width: 28, textAlign: 'right' },
});
