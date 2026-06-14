import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Pitch, type PitchSlot } from '../../src/components/Pitch';
import { PlayerRow } from '../../src/components/PlayerRow';
import { FORMATIONS, type Formation, overall, TRAINING, validateXI } from '../../src/engine';
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

  const openPlayer = (id: string) => router.push(`/player?id=${id}`);

  // An injured/suspended player can't be put into the XI; warn and abort the swap.
  const blockIfUnavailable = (incomingId: string): boolean => {
    const p = game.world.players[incomingId];
    const status = p ? playerAvailability(p) : null;
    if (status) {
      Alert.alert('Player unavailable', `${p.name} is ${status.kind} and can't be selected right now (${status.label}).`);
      return true;
    }
    return false;
  };

  const tap = (id: string) => {
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    const selInXI = xiSet.has(selected);
    const tapInXI = xiSet.has(id);
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Formation</Text>
      <View style={styles.formationRow}>
        {FORMATION_KEYS.map((f) => (
          <Pressable
            key={f}
            onPress={() => changeFormation(f)}
            style={[styles.formChip, squad.formation === f && styles.formChipActive]}
          >
            <Text style={[styles.formText, squad.formation === f && styles.formTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        label={`🏋  Training · ${trainingCount}/${TRAINING.SLOTS}`}
        variant="secondary"
        onPress={() => router.push('/training')}
        style={styles.trainingBtn}
      />

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
          <PlayerRow
            key={p.id}
            player={p}
            selected={selected === p.id}
            onPress={() => tap(p.id)}
            onLongPress={() => openPlayer(p.id)}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

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
  trainingBtn: { marginTop: theme.spacing(0.5) },
  formText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  formTextActive: { color: theme.colors.onPrimary },
  listCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errorBanner: { backgroundColor: theme.dark ? '#3a1d1f' : '#fdecea', borderColor: theme.colors.danger },
  errorText: { color: theme.dark ? '#ff9b9e' : theme.colors.danger, fontSize: theme.font.small },
  warnBanner: { backgroundColor: theme.dark ? '#3a3320' : '#fdf3d6', borderColor: theme.colors.draw },
  warnText: { color: theme.dark ? '#e6cf86' : theme.colors.draw, fontSize: theme.font.small },
});
