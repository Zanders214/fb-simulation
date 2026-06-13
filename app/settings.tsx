import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useGameStore } from '../src/store/gameStore';
import { confirmAction } from '../src/ui/confirm';
import { theme } from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const hasSave = useGameStore((s) => s.game !== null);
  const resetGame = useGameStore((s) => s.resetGame);

  const confirmReset = () => {
    confirmAction({
      title: 'Delete save?',
      message: 'Your current career will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        resetGame();
        router.dismissTo('/');
      },
    });
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.label}>Save</Text>
        <Text style={styles.value}>{hasSave ? 'A career is in progress.' : 'No saved career.'}</Text>
        <Button label="Delete save" variant="danger" onPress={confirmReset} disabled={!hasSave} style={styles.btn} />
      </Card>

      <Card style={styles.mt}>
        <Text style={styles.label}>About</Text>
        <Text style={styles.value}>FB Simulation · pre-alpha</Text>
        <Text style={styles.muted}>Fictional clubs and players. Built with Expo + React Native.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(2) },
  mt: { marginTop: theme.spacing(2) },
  label: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: theme.colors.text, fontSize: theme.font.body, marginTop: theme.spacing(0.5) },
  muted: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.spacing(1) },
  btn: { marginTop: theme.spacing(2) },
});
