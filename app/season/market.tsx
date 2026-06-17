import { Redirect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  type ListRenderItem,
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
import { flagFor, formatMoney } from '../../src/ui/format';

type Mode = 'buy' | 'sell';
type PosFilter = Position | 'ALL';
const POS_FILTERS: PosFilter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

type SortDir = 'asc' | 'desc';

type BuySort = 'value' | 'rating' | 'age' | 'potential' | 'position';
// label + natural default direction (desc = best/highest first)
const BUY_SORTS: { key: BuySort; label: string; defaultDir: SortDir }[] = [
  { key: 'value', label: 'Price', defaultDir: 'desc' },
  { key: 'rating', label: 'Rating', defaultDir: 'desc' },
  { key: 'age', label: 'Age', defaultDir: 'asc' }, // youngest first
  { key: 'potential', label: 'Potential', defaultDir: 'desc' },
  { key: 'position', label: 'Position', defaultDir: 'asc' },
];

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
const playerKey = (p: Player) => p.id;

export default function MarketScreen() {
  const game = useGame();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const buy = useGameStore((s) => s.buy);
  const sell = useGameStore((s) => s.sell);

  const [mode, setMode] = useState<Mode>('buy');
  const [pos, setPos] = useState<PosFilter>('ALL');
  const [leagueId, setLeagueId] = useState<string>('ALL');
  const [nat, setNat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [buySort, setBuySort] = useState<BuySort>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sellSort, setSellSort] = useState<SellSort>('status');

  const leagues = useMemo(() => (game ? Object.values(game.world.leagues) : []), [game]);

  // Distinct nationalities present in the buyable pool, alphabetised.
  const nationalities = useMemo(() => {
    if (!game) return [];
    const set = new Set<string>();
    for (const p of Object.values(game.world.players)) {
      if (p.clubId !== game.managedClubId) set.add(p.nationality);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [game]);

  // Tapping a sort chip: flip direction if it's already active, else switch to
  // it at its natural default direction.
  const onSort = useCallback(
    (s: { key: BuySort; defaultDir: SortDir }) => {
      if (s.key === buySort) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setBuySort(s.key);
        setSortDir(s.defaultDir);
      }
    },
    [buySort],
  );

  const budget = game ? clubBudget(game.world, game.managedClubId) : 0;
  const squadCount = game ? game.world.clubs[game.managedClubId].playerIds.length : 0;

  const buyList = useMemo(() => {
    if (!game || mode !== 'buy') return [];
    const q = search.trim().toLowerCase();
    const m = sortDir === 'asc' ? 1 : -1;
    const base: Record<BuySort, (a: Player, b: Player) => number> = {
      value: (a, b) => playerValue(a) - playerValue(b),
      rating: (a, b) => overall(a) - overall(b),
      age: (a, b) => a.age - b.age,
      potential: (a, b) => a.potential - b.potential,
      position: (a, b) => POS_RANK[a.position] - POS_RANK[b.position],
    };
    const cmp = base[buySort];
    return Object.values(game.world.players)
      .filter((p) => p.clubId !== game.managedClubId)
      .filter((p) => pos === 'ALL' || p.position === pos)
      .filter((p) => leagueId === 'ALL' || game.world.clubs[p.clubId]?.leagueId === leagueId)
      .filter((p) => nat === 'ALL' || p.nationality === nat)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => m * cmp(a, b) || playerValue(b) - playerValue(a));
  }, [game, mode, pos, leagueId, nat, search, buySort, sortDir]);

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

  const onBuy = useCallback((id: string) => {
    const res = buy(id);
    if (!res.ok) Alert.alert('Transfer blocked', res.reason);
  }, [buy]);
  const onSell = useCallback((id: string) => {
    const res = sell(id);
    if (!res.ok) Alert.alert('Sale blocked', res.reason);
  }, [sell]);
  const openPlayer = useCallback((id: string) => router.push(`/player?id=${id}`), [router]);

  const renderBuyRow = useCallback<ListRenderItem<Player>>(
    ({ item }) => {
      if (!game) return null;
      const fee = playerValue(item);
      const club = game.world.clubs[item.clubId];
      const sellerSize = club.playerIds.length;
      const affordable = fee <= budget && squadCount < MARKET.MAX_SQUAD && sellerSize > MARKET.MIN_SQUAD;
      return (
        <MarketBuyRow
          player={item}
          subtitle={`${club.shortName} · OVR ${overall(item)} · Age ${item.age}`}
          fee={fee}
          affordable={affordable}
          onOpenPlayer={openPlayer}
          onBuy={onBuy}
        />
      );
    },
    [game, budget, squadCount, openPlayer, onBuy],
  );

  const renderSellRow = useCallback<ListRenderItem<Player>>(
    ({ item }) => {
      if (!game) return null;
      const proceeds = Math.round((playerValue(item) * MARKET.SELL_RETURN) / 100) * 100;
      const canSell = squadCount > MARKET.MIN_SQUAD && !!findBuyer(game.world, item, game.managedClubId);
      return (
        <MarketSellRow
          player={item}
          subtitle={`${ROLE_LABELS[squadRole(game, item.id)]} · OVR ${overall(item)} · Age ${item.age}`}
          proceeds={proceeds}
          canSell={canSell}
          onOpenPlayer={openPlayer}
          onSell={onSell}
        />
      );
    },
    [game, squadCount, openPlayer, onSell],
  );

  const listEmpty = useMemo(
    () => (
      <Text style={styles.empty}>
        {mode === 'buy' ? 'No players match your filters.' : 'No players to sell.'}
      </Text>
    ),
    [styles, mode],
  );

  if (!game) return <Redirect href="/" />;

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
          <ModeButton key={m} mode={m} active={mode === m} onSelect={setMode} />
        ))}
      </View>

      {mode === 'buy' && (
        <View style={styles.filters}>
          <View style={styles.chipRow}>
            {POS_FILTERS.map((p) => (
              <FilterChip key={p} label={p} active={pos === p} value={p} onSelect={setPos} />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip label="All leagues" active={leagueId === 'ALL'} value="ALL" onSelect={setLeagueId} />
            {leagues.map((l) => (
              <FilterChip
                key={l.id}
                label={l.name}
                active={leagueId === l.id}
                value={l.id}
                onSelect={setLeagueId}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip label="All nations" active={nat === 'ALL'} value="ALL" onSelect={setNat} />
            {nationalities.map((n) => (
              <FilterChip
                key={n}
                label={`${flagFor(n)} ${n}`}
                active={nat === n}
                value={n}
                onSelect={setNat}
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
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort</Text>
            {BUY_SORTS.map((s) => {
              const active = buySort === s.key;
              const arrow = sortDir === 'asc' ? '↑' : '↓';
              const label = active ? `${s.label} ${arrow}` : s.label;
              return (
                <FilterChip
                  key={s.key}
                  label={label}
                  active={active}
                  value={s}
                  onSelect={onSort}
                />
              );
            })}
          </View>
        </View>
      )}

      {mode === 'sell' && (
        <View style={styles.chipRow}>
          {SELL_SORTS.map((s) => (
            <FilterChip
              key={s.key}
              label={s.label}
              active={sellSort === s.key}
              value={s.key}
              onSelect={setSellSort}
            />
          ))}
        </View>
      )}

      <FlatList
        data={mode === 'buy' ? buyList : sellList}
        keyExtractor={playerKey}
        renderItem={mode === 'buy' ? renderBuyRow : renderSellRow}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={11}
        ListEmptyComponent={listEmpty}
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

// Memoised buy/sell mode toggle button: stable onPress from the stable setMode +
// its own mode value.
const ModeButton = memo(function ModeButton({
  mode,
  active,
  onSelect,
}: Readonly<{ mode: Mode; active: boolean; onSelect: (mode: Mode) => void }>) {
  const styles = useThemedStyles(makeStyles);
  const onPress = useCallback(() => onSelect(mode), [onSelect, mode]);
  return (
    <Pressable onPress={onPress} style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {mode === 'buy' ? 'Buy players' : 'Sell players'}
      </Text>
    </Pressable>
  );
});

// Memoised market rows: each owns the per-item onPress (open player) and its
// Action's onPress (buy/sell), built from the screen's stable callbacks + its
// own id — so the FlatList rows don't get fresh closures / JSX props per render.
const MarketBuyRow = memo(function MarketBuyRow({
  player,
  subtitle,
  fee,
  affordable,
  onOpenPlayer,
  onBuy,
}: Readonly<{
  player: Player;
  subtitle: string;
  fee: number;
  affordable: boolean;
  onOpenPlayer: (id: string) => void;
  onBuy: (id: string) => void;
}>) {
  const open = useCallback(() => onOpenPlayer(player.id), [onOpenPlayer, player.id]);
  const doBuy = useCallback(() => onBuy(player.id), [onBuy, player.id]);
  const right = useMemo(
    () => <Action label="Buy" amount={fee} enabled={affordable} onPress={doBuy} />,
    [fee, affordable, doBuy],
  );
  return <PlayerRow player={player} subtitle={subtitle} onPress={open} right={right} />;
});

const MarketSellRow = memo(function MarketSellRow({
  player,
  subtitle,
  proceeds,
  canSell,
  onOpenPlayer,
  onSell,
}: Readonly<{
  player: Player;
  subtitle: string;
  proceeds: number;
  canSell: boolean;
  onOpenPlayer: (id: string) => void;
  onSell: (id: string) => void;
}>) {
  const open = useCallback(() => onOpenPlayer(player.id), [onOpenPlayer, player.id]);
  const doSell = useCallback(() => onSell(player.id), [onSell, player.id]);
  const right = useMemo(
    () => <Action label="Sell" amount={proceeds} enabled={canSell} onPress={doSell} />,
    [proceeds, canSell, doSell],
  );
  return <PlayerRow player={player} subtitle={subtitle} onPress={open} right={right} />;
});

// Generic chip: owns a stable onPress built from the parent's stable onSelect +
// its own value, so the filter/sort maps don't hand each chip a fresh closure
// every render.
function FilterChip<T>({
  label,
  active,
  value,
  onSelect,
}: Readonly<{ label: string; active: boolean; value: T; onSelect: (value: T) => void }>) {
  const styles = useThemedStyles(makeStyles);
  const onPress = useCallback(() => onSelect(value), [onSelect, value]);
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
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(1) },
  sortLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
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
