import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../src/components/Card';
import { PlayerRow } from '../../src/components/PlayerRow';
import {
  clubBudget,
  findBuyer,
  MARKET,
  overall,
  type Player,
  playerValue,
  type Position,
} from '../../src/engine';
import { useGame, useGameStore } from '../../src/store/gameStore';
import { clubPlayers } from '../../src/store/selectors';
import { useTheme, useThemedStyles, type Theme } from '../../src/theme';
import { formatMoney } from '../../src/ui/format';

type Mode = 'buy' | 'sell';
type PosFilter = Position | 'ALL';
const POS_FILTERS: PosFilter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

type SellSort = 'status' | 'value' | 'rating' | 'position';
const SELL_SORTS: { key: SellSort; label: string }[] = [
  { key: 'status', label: 'Squad role' },
  { key: 'value', label: 'Value' },
  { key: 'rating', label: 'Rating' },
  { key: 'position', label: 'Position' },
];
const POS_RANK: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/** Where the player sits in the user's squad: starting XI, then bench, then reserve. */
function squadRole(game: NonNullable<ReturnType<typeof useGame>>, id: string): number {
  if (game.squad.startingXI.includes(id)) return 0;
  if (game.squad.bench.includes(id)) return 1;
  return 2;
}
const ROLE_LABELS = ['Starting XI', 'Substitute', 'Reserve'];

export default function MarketScreen() {
  const game = useGame();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const buy = useGameStore((s) => s.buy);
  const sell = useGameStore((s) => s.sell);

  const [mode, setMode] = useState<Mode>('buy');
  const [pos, setPos] = useState<PosFilter>('ALL');
  const [leagueId, setLeagueId] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [sellSort, setSellSort] = useState<SellSort>('status');

  const leagues = useMemo(() => (game ? Object.values(game.world.leagues) : []), [game]);

  const budget = game ? clubBudget(game.world, game.managedClubId) : 0;
  const squadCount = game ? game.world.clubs[game.managedClubId].playerIds.length : 0;

  const buyList = useMemo(() => {
    if (!game || mode !== 'buy') return [];
    const q = search.trim().toLowerCase();
    return Object.values(game.world.players)
      .filter((p) => p.clubId !== game.managedClubId)
      .filter((p) => pos === 'ALL' || p.position === pos)
      .filter((p) => leagueId === 'ALL' || game.world.clubs[p.clubId]?.leagueId === leagueId)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => playerValue(b) - playerValue(a));
  }, [game, mode, pos, leagueId, search]);

  const sellList = useMemo(() => {
    if (!game || mode !== 'sell') return [];
    const byValue = (a: Player, b: Player) => playerValue(b) - playerValue(a);
    const cmp: Record<SellSort, (a: Player, b: Player) => number> = {
      status: (a, b) => squadRole(game, a.id) - squadRole(game, b.id) || byValue(a, b),
      value: byValue,
      rating: (a, b) => overall(b) - overall(a) || byValue(a, b),
      position: (a, b) => POS_RANK[a.position] - POS_RANK[b.position] || byValue(a, b),
    };
    return clubPlayers(game, game.managedClubId).sort(cmp[sellSort]);
  }, [game, mode, sellSort]);

  if (!game) return <Redirect href="/" />;

  const onBuy = (id: string) => {
    const res = buy(id);
    if (!res.ok) Alert.alert('Transfer blocked', res.reason);
  };
  const onSell = (id: string) => {
    const res = sell(id);
    if (!res.ok) Alert.alert('Sale blocked', res.reason);
  };

  const renderBuyRow = ({ item }: { item: Player }) => {
    const fee = playerValue(item);
    const club = game.world.clubs[item.clubId];
    const sellerSize = club.playerIds.length;
    const affordable = fee <= budget && squadCount < MARKET.MAX_SQUAD && sellerSize > MARKET.MIN_SQUAD;
    return (
      <PlayerRow
        player={item}
        subtitle={`${club.shortName} · OVR ${overall(item)} · Age ${item.age}`}
        right={
          <Action label="Buy" amount={fee} enabled={affordable} onPress={() => onBuy(item.id)} />
        }
      />
    );
  };

  const renderSellRow = ({ item }: { item: Player }) => {
    const proceeds = Math.round((playerValue(item) * MARKET.SELL_RETURN) / 100) * 100;
    const canSell = squadCount > MARKET.MIN_SQUAD && !!findBuyer(game.world, item, game.managedClubId);
    return (
      <PlayerRow
        player={item}
        subtitle={`${ROLE_LABELS[squadRole(game, item.id)]} · OVR ${overall(item)} · Age ${item.age}`}
        right={
          <Action label="Sell" amount={proceeds} enabled={canSell} onPress={() => onSell(item.id)} />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerLabel}>Transfer budget</Text>
          <Text style={styles.squad}>
            Squad {squadCount}/{MARKET.MAX_SQUAD}
          </Text>
        </View>
        <Text style={styles.budget}>{formatMoney(budget)}</Text>
      </Card>

      <View style={styles.toggle}>
        {(['buy', 'sell'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
              {m === 'buy' ? 'Buy players' : 'Sell players'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'buy' && (
        <View style={styles.filters}>
          <View style={styles.chipRow}>
            {POS_FILTERS.map((p) => (
              <FilterChip key={p} label={p} active={pos === p} onPress={() => setPos(p)} />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip label="All leagues" active={leagueId === 'ALL'} onPress={() => setLeagueId('ALL')} />
            {leagues.map((l) => (
              <FilterChip
                key={l.id}
                label={l.name}
                active={leagueId === l.id}
                onPress={() => setLeagueId(l.id)}
              />
            ))}
          </ScrollView>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.search}
          />
        </View>
      )}

      {mode === 'sell' && (
        <View style={styles.chipRow}>
          {SELL_SORTS.map((s) => (
            <FilterChip
              key={s.key}
              label={s.label}
              active={sellSort === s.key}
              onPress={() => setSellSort(s.key)}
            />
          ))}
        </View>
      )}

      <FlatList
        data={mode === 'buy' ? buyList : sellList}
        keyExtractor={(p) => p.id}
        renderItem={mode === 'buy' ? renderBuyRow : renderSellRow}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={11}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {mode === 'buy' ? 'No players match your filters.' : 'No players to sell.'}
          </Text>
        }
      />
    </View>
  );
}

function Action({
  label,
  amount,
  enabled,
  onPress,
}: Readonly<{ label: string; amount: number; enabled: boolean; onPress: () => void }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.action}>
      <Text style={styles.fee}>{formatMoney(amount)}</Text>
      <Pressable
        onPress={onPress}
        disabled={!enabled}
        accessibilityRole="button"
        style={[styles.actionBtn, !enabled && styles.actionBtnDisabled]}
      >
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(2), gap: theme.spacing(1) },
  header: { gap: theme.spacing(0.5) },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
  squad: { color: theme.colors.textMuted, fontSize: theme.font.small },
  budget: { color: theme.colors.accent, fontSize: theme.font.heading, fontWeight: '800' },
  toggle: { flexDirection: 'row', gap: theme.spacing(1) },
  toggleBtn: {
    flex: 1,
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  toggleText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  toggleTextActive: { color: theme.colors.onPrimary },
  filters: { gap: theme.spacing(1) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) },
  filterChip: {
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  filterTextActive: { color: theme.colors.onPrimary },
  search: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
  list: { flex: 1 },
  listContent: { paddingVertical: theme.spacing(1), gap: theme.spacing(0.25), paddingBottom: theme.spacing(4) },
  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', marginTop: theme.spacing(3) },
  action: { alignItems: 'flex-end', gap: theme.spacing(0.5), minWidth: 84 },
  fee: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small },
  actionBtn: {
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.5),
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  actionBtnDisabled: { backgroundColor: theme.colors.surfaceAlt, opacity: 0.5 },
  actionText: { color: theme.colors.onPrimary, fontWeight: '700', fontSize: theme.font.small },
});
