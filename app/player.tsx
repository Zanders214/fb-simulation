import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Meta } from '../src/components/Meta';
import { Section } from '../src/components/Section';
import { StatLine } from '../src/components/StatLine';
import { areaRating, clubBudget, findBuyer, MARKET, overall, playerValue, type Area, type GameState, type Player } from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { confirmAction } from '../src/ui/confirm';
import { availabilityColor, flagFor, formatMoney, formColor, formSymbol, formValue, matchesLabel, overallColor, playerAvailability, positionColor } from '../src/ui/format';
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

// Readable gold for the yellow-card count (the literal card amber is too light on
// a white background); reds use the theme's loss colour.
const YELLOW_TEXT = '#d4a017';

export default function PlayerScreen() {
  const game = useGame();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const buy = useGameStore((s) => s.buy);
  const sell = useGameStore((s) => s.sell);
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = game && id ? game.world.players[id] : undefined;

  if (!game || !player) return <Redirect href="/season" />;

  const ovr = overall(player);
  const club = game.world.clubs[player.clubId];
  const careerGoals = player.careerGoals ?? 0;
  const careerAssists = player.careerAssists ?? 0;
  const careerApps = player.careerApps ?? 0;
  const seasonSubApps = player.seasonSubApps ?? 0;
  const careerSubApps = player.careerSubApps ?? 0;
  const careerCleanSheets = player.careerCleanSheets ?? 0;
  const seasonCleanSheets = player.seasonCleanSheets ?? 0;
  const availability = playerAvailability(player);
  const value = playerValue(player);
  // max(stored, current) keeps pre-update saves sensible before the next match.
  const peakValue = Math.max(player.peakValue ?? 0, value);
  const showCleanSheets = player.position === 'GK' || player.position === 'DEF';
  const transfer = transferState(game, player, value);

  const onTransfer = () => {
    if (transfer.mode === 'sell') {
      confirmAction({
        title: 'Sell player?',
        message: `Sell ${player.name} for ${formatMoney(transfer.amount)}?`,
        confirmLabel: 'Sell',
        destructive: true,
        onConfirm: () => {
          const res = sell(player.id);
          if (!res.ok) Alert.alert('Sale blocked', res.reason);
        },
      });
    } else {
      confirmAction({
        title: 'Buy player?',
        message: `Sign ${player.name} for ${formatMoney(transfer.amount)}?`,
        confirmLabel: 'Buy',
        onConfirm: () => {
          const res = buy(player.id);
          if (!res.ok) Alert.alert('Transfer blocked', res.reason);
        },
      });
    }
  };

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
              <Pressable onPress={() => router.push(`/club?id=${player.clubId}`)} hitSlop={6} accessibilityRole="button">
                <Text style={styles.club} numberOfLines={1}>
                  {club.name} ›
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.ovr, { color: overallColor(ovr, theme) }]}>{ovr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Meta label="Position" value={POSITION_NAME[player.position] ?? player.position} />
          <Meta label={player.nationality} value={flagFor(player.nationality)} />
          <Meta label="Age" value={`${player.age}`} />
        </View>
      </Card>

      {availability && (
        <Card style={[styles.statusBanner, { borderColor: availabilityColor(availability.kind) }]}>
          <Text style={[styles.statusText, { color: availabilityColor(availability.kind) }]}>
            {availability.kind === 'injured' ? '✚ Injured' : '⊘ Suspended'} · out {matchesLabel(availability.matches)}
          </Text>
        </Card>
      )}

      <Section title="Attributes">
        <Card style={styles.card}>
          {AREAS.map(({ key, label }) => (
            <StatBar key={key} label={label} value={Math.round(areaRating(player, key))} />
          ))}
        </Card>
      </Section>

      <Section title="Form">
        <Card style={styles.card}>
          <View style={styles.formRow}>
            <Text style={styles.formNote}>affects next match &amp; development</Text>
            <Text style={[styles.formValue, { color: formColor(player.form, theme) }]}>
              {formSymbol(player.form)} {formValue(player.form)}
            </Text>
          </View>
        </Card>
      </Section>

      <Section title="Value">
        <Card style={styles.card}>
          <StatLine label="Market value" value={formatMoney(value)} />
          <StatLine label="Peak value" value={formatMoney(peakValue)} />
        </Card>
      </Section>

      <Section title="Transfer">
        <Card style={styles.card}>
          <Button
            label={`${transfer.mode === 'sell' ? 'Sell' : 'Buy'} · ${formatMoney(transfer.amount)}`}
            variant={transfer.mode === 'sell' ? 'danger' : 'primary'}
            disabled={!transfer.enabled}
            onPress={onTransfer}
          />
          {!transfer.enabled && transfer.reason ? <Text style={styles.reason}>{transfer.reason}</Text> : null}
        </Card>
      </Section>

      <Section title="This season">
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${player.seasonGoals}`} />
          <Stat label="Assists" value={`${player.seasonAssists}`} />
          <Stat label="Apps (sub)" value={`${player.seasonApps} (${seasonSubApps})`} />
          {showCleanSheets ? <Stat label="Clean sheets" value={`${seasonCleanSheets}`} /> : null}
          <Stat label="Yellows" value={`${player.seasonYellowCards ?? 0}`} color={YELLOW_TEXT} />
          <Stat label="Reds" value={`${player.seasonRedCards ?? 0}`} color={theme.colors.loss} />
        </Card>
      </Section>

      <Section title="All time">
        <Card style={styles.statGrid}>
          <Stat label="Goals" value={`${careerGoals}`} />
          <Stat label="Assists" value={`${careerAssists}`} />
          <Stat label="Apps (sub)" value={`${careerApps} (${careerSubApps})`} />
          {showCleanSheets ? <Stat label="Clean sheets" value={`${careerCleanSheets}`} /> : null}
          <Stat label="Yellows" value={`${player.careerYellowCards ?? 0}`} color={YELLOW_TEXT} />
          <Stat label="Reds" value={`${player.careerRedCards ?? 0}`} color={theme.colors.loss} />
        </Card>
      </Section>
    </ScrollView>
  );
}

interface TransferInfo {
  mode: 'buy' | 'sell';
  amount: number; // fee to pay (buy) or proceeds received (sell), in thousands
  enabled: boolean;
  reason?: string;
}

/** Whether the managed club can buy/sell this player, and for how much — mirrors market.tsx. */
function transferState(game: GameState, player: Player, value: number): TransferInfo {
  const { world, managedClubId } = game;
  const squadCount = world.clubs[managedClubId].playerIds.length;
  if (player.clubId === managedClubId) {
    const amount = Math.round((value * MARKET.SELL_RETURN) / 100) * 100;
    if (squadCount <= MARKET.MIN_SQUAD) {
      return { mode: 'sell', amount, enabled: false, reason: `You must keep at least ${MARKET.MIN_SQUAD} players.` };
    }
    if (!findBuyer(world, player, managedClubId)) {
      return { mode: 'sell', amount, enabled: false, reason: 'No club is interested right now.' };
    }
    return { mode: 'sell', amount, enabled: true };
  }
  const amount = value;
  const sellerSize = world.clubs[player.clubId].playerIds.length;
  if (squadCount >= MARKET.MAX_SQUAD) {
    return { mode: 'buy', amount, enabled: false, reason: `Your squad is full (max ${MARKET.MAX_SQUAD}).` };
  }
  if (sellerSize <= MARKET.MIN_SQUAD) {
    return { mode: 'buy', amount, enabled: false, reason: 'Their squad is too thin to sell.' };
  }
  if (clubBudget(world, managedClubId) < amount) {
    return { mode: 'buy', amount, enabled: false, reason: 'Not enough funds for this transfer.' };
  }
  return { mode: 'buy', amount, enabled: true };
}

function Stat({ label, value, color }: Readonly<{ label: string; value: string; color?: string }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statBig, color ? { color } : null]}>{value}</Text>
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
  reason: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center' },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formNote: { color: theme.colors.textMuted, fontSize: theme.font.small, flex: 1 },
  formValue: { fontSize: theme.font.heading, fontWeight: '900' },
  statusBanner: { borderWidth: 1, alignItems: 'center', paddingVertical: theme.spacing(1.25) },
  statusText: { fontSize: theme.font.body, fontWeight: '800', letterSpacing: 0.3 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: theme.spacing(2) },
  stat: { alignItems: 'center', width: '30%' },
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
