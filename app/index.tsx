import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { MatchdayHome } from '../src/components/home/MatchdayHome';
import { useGame, useGameStore } from '../src/store/gameStore';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hasHydrated = useGameStore((s) => s.hasHydrated);
  const game = useGame();

  const startNewGame = useCallback(() => router.push('/new-game'), [router]);
  const goToSettings = useCallback(() => router.push('/settings'), [router]);

  if (!hasHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  // With an active career, Home is the matchday dashboard; otherwise a start menu.
  if (game) return <MatchdayHome game={game} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>⚽</Text>
        <Text style={styles.title}>FB Simulation</Text>
        <Text style={styles.subtitle}>Build your club. Pick a league. Play the season.</Text>
      </View>

      <View style={styles.menu}>
        <Button label="New Game" onPress={startNewGame} testID="home-new-game" />
        <Button label="Settings" variant="ghost" onPress={goToSettings} testID="home-settings" />
      </View>

      <Text style={styles.footer}>pre-alpha</Text>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontWeight: theme.fonts.headingWeight,
    fontSize: theme.font.title,
    letterSpacing: 0.5,
    textTransform: theme.fonts.uppercaseHeadings ? 'uppercase' : 'none',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: theme.font.body,
    textAlign: 'center',
    paddingHorizontal: theme.spacing(2),
  },
  menu: { gap: theme.spacing(1.5) },
  footer: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: theme.font.small,
    textAlign: 'center',
    marginTop: theme.spacing(2),
  },
});
