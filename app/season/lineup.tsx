import { Redirect, router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Pitch, type PitchSlot } from '../../src/components/Pitch';
import { PlayerRow } from '../../src/components/PlayerRow';
import { FORMATIONS, type Formation, overall, type Player, TRAINING, validateXI } from '../../src/engine';
import { useGame, useGameStore } from '../../src/store/gameStore';
import { clubPlayers, trainingPlayers } from '../../src/store/selectors';
import { useThemedStyles, type Theme } from '../../src/theme';
import { FORMATION_LAYOUTS } from '../../src/ui/formationLayout';
import { playerAvailability } from '../../src/ui/format';

const FORMATION_KEYS = Object.keys(FORMATIONS) as Formation[];

export default function LineupScreen() {
  const game = useGame();
  const styles = useThemedStyles(makeStyles);
  const changeFormation = useGameStore((s) => s.changeFormation);
  const substitute = useGameStore((s) => s.substitute);
  const swapPositions = useGameStore((s) => s.swapPositions);
  const [selected, setSelected] = useState<string | null>(null);

  // Stable nav handlers (router is a module singleton) so the buttons / Pitch
  // don't get a fresh function each render. Declared before the early return so
  // the hooks run unconditionally.
  const openPlayer = useCallback((id: string) => router.push(`/player?id=${id}`), []);
  const goRoles = useCallback(() => router.push('/roles'), []);
  const goTraining = useCallback(() => router.push('/training'), []);

  const tap = useCallback(
    (id: string) => {
      const g = useGameStore.getState().game;
      if (!g) return;
      if (!selected) {
        setSelected(id);
        return;
      }
      if (selected === id) {
        setSelected(null);
        return;
      }
      const xi = new Set(g.squad.startingXI);
      // An injured/suspended player can't be put into the XI; warn and abort.
      const blockIfUnavailable = (incomingId: string): boolean => {
        const p = g.world.players[incomingId];
        const status = p ? playerAvailability(p) : null;
        if (status) {
          Alert.alert('Player unavailable', `${p.name} is ${status.kind} and can't be selected right now (${status.label}).`);
          return true;
        }
        return false;
      };
      const selInXI = xi.has(selected);
      const tapInXI = xi.has(id);
      if (selInXI && tapInXI) {
        swapPositions(selected, id);
      } else if (selInXI && !tapInXI) {
        if (blockIfUnavailable(id)) {
          setSelected(null);
          return;
        }
        substitute(selected, id);
      } else if (!selInXI && tapInXI) {
        if (blockIfUnavailable(selected)) {
          setSelected(null);
          return;
        }
        substitute(id, selected);
      } else {
        setSelected(id);
        return;
      }
      setSelected(null);
    },
    [selected, swapPositions, substitute],
  );

  if (!game) return <Redirect href="/" />;
  const { squad } = game;
  const xiSet = new Set(squad.startingXI);

  const layout = FORMATION_LAYOUTS[squad.formation];
  const pitchSlots: PitchSlot[] = squad.startingXI
    .map((id, i) => ({ slot: layout[i], player: game.world.players[id] }))
    .filter((s): s is PitchSlot => Boolean(s.slot && s.player));
  const available = clubPlayers(game, game.managedClubId)
    .filter((p) => !xiSet.has(p.id))
    .sort((a, b) => overall(b) - overall(a));

  const trainingCount = trainingPlayers(game).length;
  const issues = validateXI(game.world, squad, game.managedClubId);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Formation</Text>
      <View style={styles.formationRow}>
        {FORMATION_KEYS.map((f) => (
          <FormationChip
            key={f}
            formation={f}
            active={squad.formation === f}
            onSelect={changeFormation}
          />
        ))}
      </View>

      <View style={styles.actionRow}>
        <Button label="⭐  Roles" variant="secondary" onPress={goRoles} style={styles.actionBtn} />
        <Button
          label={`🏋  Training · ${trainingCount}/${TRAINING.SLOTS}`}
          variant="secondary"
          onPress={goTraining}
          style={styles.actionBtn}
        />
      </View>

      {errors.length > 0 && (
        <Card style={styles.errorBanner}>
          {errors.map((e) => (
            <Text key={e.message} style={styles.errorText}>⚠ {e.message}</Text>
          ))}
        </Card>
      )}
      {errors.length === 0 && warnings.length > 0 && (
        <Card style={styles.warnBanner}>
          {warnings.map((w) => (
            <Text key={w.message} style={styles.warnText}>{w.message}</Text>
          ))}
        </Card>
      )}

      <Text style={styles.hint}>
        Tap a player, then a substitute to swap them — or another starter to switch their positions.
      </Text>

      <Text style={styles.sectionTitle}>Starting XI · {squad.formation}</Text>
      <Pitch slots={pitchSlots} selectedId={selected} onSelect={tap} onLongPressPlayer={openPlayer} />

      <Text style={styles.sectionTitle}>Substitutes & reserves</Text>
      <Card style={styles.listCard}>
        {available.map((p) => (
          <SubstituteRow
            key={p.id}
            player={p}
            selected={selected === p.id}
            onTap={tap}
            onOpenPlayer={openPlayer}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

// Memoised formation chip: owns a stable onPress (stable changeFormation + its
// own key) so the formation map doesn't hand each chip a fresh closure.
const FormationChip = memo(function FormationChip({
  formation,
  active,
  onSelect,
}: Readonly<{
  formation: Formation;
  active: boolean;
  onSelect: (formation: Formation) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const handlePress = useCallback(() => onSelect(formation), [onSelect, formation]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.formChip, active && styles.formChipActive]}
    >
      <Text style={[styles.formText, active && styles.formTextActive]}>{formation}</Text>
    </Pressable>
  );
});

// Memoised substitute row: owns stable onPress/onLongPress (built from the
// stable tap/openPlayer + its own id) instead of fresh per-render closures.
const SubstituteRow = memo(function SubstituteRow({
  player,
  selected,
  onTap,
  onOpenPlayer,
}: Readonly<{
  player: Player;
  selected: boolean;
  onTap: (id: string) => void;
  onOpenPlayer: (id: string) => void;
}>) {
  const handlePress = useCallback(() => onTap(player.id), [onTap, player.id]);
  const handleLongPress = useCallback(() => onOpenPlayer(player.id), [onOpenPlayer, player.id]);
  return (
    <PlayerRow player={player} selected={selected} onPress={handlePress} onLongPress={handleLongPress} />
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1), paddingBottom: theme.spacing(4) },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing(1),
  },
  formationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) },
  formChip: {
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  formChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  actionRow: { flexDirection: 'row', gap: theme.spacing(1), marginTop: theme.spacing(0.5) },
  actionBtn: { flex: 1, paddingHorizontal: theme.spacing(1) },
  formText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  formTextActive: { color: theme.colors.onPrimary },
  listCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errorBanner: { backgroundColor: theme.dark ? '#3a1d1f' : '#fdecea', borderColor: theme.colors.danger },
  errorText: { color: theme.dark ? '#ff9b9e' : theme.colors.danger, fontSize: theme.font.small },
  warnBanner: { backgroundColor: theme.dark ? '#3a3320' : '#fdf3d6', borderColor: theme.colors.draw },
  warnText: { color: theme.dark ? '#e6cf86' : theme.colors.draw, fontSize: theme.font.small },
});
