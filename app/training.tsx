import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { PlayerRow } from '../src/components/PlayerRow';
import { overall, TRAINING } from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { clubPlayers } from '../src/store/selectors';
import { theme } from '../src/theme';

export default function TrainingScreen() {
  const game = useGame();
  const toggleTraining = useGameStore((s) => s.toggleTraining);

  if (!game) return <Redirect href="/" />;
  const { squad } = game;
  const trainingSet = new Set(squad.trainingIds ?? []);
  const used = trainingSet.size;
  const full = used >= TRAINING.SLOTS;

  const players = clubPlayers(game, game.managedClubId).sort((a, b) => overall(b) - overall(a));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        Training · {used}/{TRAINING.SLOTS} slots
      </Text>
      <Text style={styles.hint}>
        Pick up to {TRAINING.SLOTS} players to train. If they play, they develop much faster from a
        good performance and lose far less from a bad one. If they&apos;re left out, they keep
        improving on the training ground while benched players normally wouldn&apos;t.
      </Text>

      <Card style={styles.listCard}>
        {players.map((p) => {
          const inTraining = trainingSet.has(p.id);
          const dimmed = full && !inTraining;
          return (
            <PlayerRow
              key={p.id}
              player={p}
              selected={inTraining}
              onPress={() => toggleTraining(p.id)}
              right={
                <View style={styles.right}>
                  {inTraining && <Text style={styles.star}>★</Text>}
                  <Text style={[styles.ovr, dimmed && styles.dim]}>{overall(p)}</Text>
                </View>
              }
            />
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '800',
  },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  listCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.75), minWidth: 38, justifyContent: 'flex-end' },
  star: { color: theme.colors.accent, fontSize: 18 },
  ovr: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  dim: { color: theme.colors.textMuted, opacity: 0.6 },
});
