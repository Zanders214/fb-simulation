import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { useGameStore } from '../src/store/gameStore';
import { theme } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const hasHydrated = useGameStore((s) => s.hasHydrated);
  const hasSave = useGameStore((s) => s.game !== null);

  const startNewGame = () => {
    if (hasSave) {
      Alert.alert('Start a new game?', 'This will replace your current save.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New Game', style: 'destructive', onPress: () => router.push('/new-game') },
      ]);
    } else {
      router.push('/new-game');
    }
  };

  if (!hasHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>⚽</Text>
        <Text style={styles.title}>FB Simulation</Text>
        <Text style={styles.subtitle}>Build your club. Pick a league. Play the season.</Text>
      </View>

      <View style={styles.menu}>
        {hasSave && (
          <Button label="Continue" onPress={() => router.push('/season')} testID="home-continue" />
        )}
        <Button
          label="New Game"
          variant={hasSave ? 'secondary' : 'primary'}
          onPress={startNewGame}
          testID="home-new-game"
        />
        <Button label="Settings" variant="ghost" onPress={() => router.push('/settings')} testID="home-settings" />
      </View>

      <Text style={styles.footer}>pre-alpha</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(4),
    justifyContent: 'space-between',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1.5) },
  badge: { fontSize: 64 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: 'center',
    paddingHorizontal: theme.spacing(2),
  },
  menu: { gap: theme.spacing(1.5) },
  footer: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', marginTop: theme.spacing(2) },
});
