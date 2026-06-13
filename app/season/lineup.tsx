import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Pitch, type PitchSlot } from '../../src/components/Pitch';
import { PlayerRow } from '../../src/components/PlayerRow';
import { FORMATIONS, type Formation, overall, validateXI } from '../../src/engine';
import { useGame, useGameStore } from '../../src/store/gameStore';
import { clubPlayers } from '../../src/store/selectors';
import { theme } from '../../src/theme';
import { FORMATION_LAYOUTS } from '../../src/ui/formationLayout';

const FORMATION_KEYS = Object.keys(FORMATIONS) as Formation[];

export default function LineupScreen() {
  const game = useGame();
  const changeFormation = useGameStore((s) => s.changeFormation);
  const substitute = useGameStore((s) => s.substitute);
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

  const issues = validateXI(game.world, squad, game.managedClubId);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

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
    if (selInXI && !tapInXI) substitute(selected, id);
    else if (!selInXI && tapInXI) substitute(id, selected);
    else {
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

      <Text style={styles.hint}>Tap a player on the pitch, then a substitute, to swap them.</Text>

      <Text style={styles.sectionTitle}>Starting XI · {squad.formation}</Text>
      <Pitch slots={pitchSlots} selectedId={selected} onSelect={tap} />

      <Text style={styles.sectionTitle}>Substitutes & reserves</Text>
      <Card style={styles.listCard}>
        {available.map((p) => (
          <PlayerRow key={p.id} player={p} selected={selected === p.id} onPress={() => tap(p.id)} />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  formText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: theme.font.small },
  formTextActive: { color: theme.colors.onPrimary },
  listCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errorBanner: { backgroundColor: '#3a1d1f', borderColor: theme.colors.danger },
  errorText: { color: '#ff9b9e', fontSize: theme.font.small },
  warnBanner: { backgroundColor: '#3a3320', borderColor: theme.colors.draw },
  warnText: { color: '#e6cf86', fontSize: theme.font.small },
});
