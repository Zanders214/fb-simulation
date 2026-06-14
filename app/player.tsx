import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Meta } from '../src/components/Meta';
import { Section } from '../src/components/Section';
import { StatLine } from '../src/components/StatLine';
import { areaRating, overall, playerValue, type Area } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { formatMoney, overallColor, positionColor } from '../src/ui/format';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = game && id ? game.world.players[id] : undefined;

  if (!game || !player) return <Redirect href="/season" />;

  const ovr = overall(player);
  const club = game.world.clubs[player.clubId];
  const careerGoals = player.careerGoals ?? 0;
  const careerAssists = player.careerAssists ?? 0;
  const careerApps = player.careerApps ?? 0;
  const careerCleanSheets = player.careerCleanSheets ?? 0;
  const seasonCleanSheets = player.seasonCleanSheets ?? 0;
  const value = playerValue(player);
  // max(stored, current) keeps pre-update saves sensible before the next match.
  const peakValue = Math.max(player.peakValue ?? 0, value);
  const showCleanSheets = player.position === 'GK' || player.position === 'DEF';

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
          <Text style={[styles.ovr, { color: overallColor(ovr, theme) }]}>{ovr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Meta label="Position" value={POSITION_NAME[player.position] ?? player.position} />
          <Meta label="Nationality" value={player.nationality} />
          <Meta label="Age" value={`${player.age}`} />
        </View>
      </Card>

      <Section title="Attributes">
        <Card style={styles.card}>
          {AREAS.map(({ key, label }) => (
            <StatBar key={key} label={label} value={Math.round(areaRating(player, key))} />
          ))}
        </Card>
      </Section>

      <Section title="Value">
        <Card style={styles.card}>
          <StatLine label="Market value" value={formatMoney(value)} />
          <StatLine label="Peak value" value={formatMoney(peakValue)} />
        </Card>
      </Section>

      <Section title="This season">
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${player.seasonGoals}`} />
          <Stat label="Assists" value={`${player.seasonAssists}`} />
          <Stat label="Apps" value={`${player.seasonApps}`} />
          {showCleanSheets ? <Stat label="Clean sheets" value={`${seasonCleanSheets}`} /> : null}
        </Card>
      </Section>

      <Section title="All time">
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${careerGoals}`} />
          <Stat label="Assists" value={`${careerAssists}`} />
          <Stat label="Apps" value={`${careerApps}`} />
          {showCleanSheets ? <Stat label="Clean sheets" value={`${careerCleanSheets}`} /> : null}
        </Card>
      </Section>
    </ScrollView>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statBig}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

function StatBar({ label, value }: Readonly<{ label: string; value: number }>) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value}%`, backgroundColor: overallColor(value, theme) }]} />
      </View>
      <Text style={[styles.barValue, { color: overallColor(value, theme) }]}>{value}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800' },
  club: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
  ovr: { fontSize: theme.font.title, fontWeight: '900' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { gap: theme.spacing(1.25) },
  statGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statBig: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '900' },
  statTileLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
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
