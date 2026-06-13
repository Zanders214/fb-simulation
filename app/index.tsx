import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { theme } from '../src/theme';

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>⚽</Text>
        <Text style={styles.title}>FB Simulation</Text>
        <Text style={styles.subtitle}>Build your club. Pick a league. Play the season.</Text>
      </View>

      <View style={styles.menu}>
        <Button label="New Game" onPress={() => router.push('/new-game')} testID="home-new-game" />
        <Button
          label="Settings"
          variant="secondary"
          onPress={() => router.push('/settings')}
          testID="home-settings"
        />
      </View>

      <Text style={styles.footer}>v{require('../app.json').expo.version} · pre-alpha</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing(3),
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(4),
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
