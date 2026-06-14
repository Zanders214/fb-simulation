import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

/**
 * Custom header back button.
 *
 * Works around a react-native-screens bug (New Architecture, iOS 26) where the
 * native stack's back button stops responding after you push a screen, go back,
 * and push it again while an intermediate screen uses `headerShown: false`
 * (software-mansion/react-native-screens#3294). Every screen here is reached
 * through `index`/`season`, both of which hide their header, so the native
 * button is unreliable. A JS-driven button keeps working because it triggers the
 * same pop as the (still-functional) swipe-back gesture.
 */
export function HeaderBackButton({ label = 'Back' }: Readonly<{ label?: string }>) {
  const router = useRouter();
  if (!router.canGoBack()) return null;
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.btn}
    >
      <Text style={styles.chevron}>‹</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  chevron: { color: theme.colors.onPrimary, fontSize: 30, lineHeight: 32, marginRight: 1 },
  label: { color: theme.colors.onPrimary, fontSize: theme.font.body, fontWeight: '600' },
});
