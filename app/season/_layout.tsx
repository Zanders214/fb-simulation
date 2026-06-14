import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles, type Theme } from '../../src/theme';

function tabIcon(emoji: string) {
  const Icon = () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
  Icon.displayName = `TabIcon-${emoji}`;
  return Icon;
}

/**
 * Fixtures is the heart of a season, so its tab is a bold raised button in the
 * middle of the bar: a brand-colour circle that lifts above the bar with a soft
 * shadow, the label beneath it, and an accent ring when active. It's rendered via
 * a custom `tabBarButton` so we control the circle + label layout directly (the
 * default icon slot can't lift above the bar or keep the label beside a big icon).
 */
function FixturesTabButton({ accessibilityState, onPress, onLongPress }: BottomTabBarButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const focused = accessibilityState?.selected ?? false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.fabWrap, pressed && styles.fabPressed]}
    >
      <View style={[styles.fab, focused && styles.fabFocused]}>
        <Text style={styles.fabIcon}>📅</Text>
      </View>
      <Text style={[styles.fabLabel, { color: focused ? theme.colors.accent : theme.colors.textMuted }]}>
        Fixtures
      </Text>
    </Pressable>
  );
}
const renderFixturesButton = (props: BottomTabBarButtonProps) => <FixturesTabButton {...props} />;

function HeaderHomeButton() {
  const router = useRouter();
  const theme = useTheme();
  const color = theme.dark ? theme.colors.onPrimary : theme.colors.text;
  return (
    <Pressable onPress={() => router.dismissTo('/')} hitSlop={10} style={{ paddingHorizontal: 14 }}>
      <Text style={{ color, fontSize: 22 }}>⌂</Text>
    </Pressable>
  );
}

const renderHeaderHome = () => <HeaderHomeButton />;

export default function SeasonLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerBg = theme.dark ? theme.colors.primaryDark : theme.colors.surface;
  const headerText = theme.dark ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerText,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          // Let the raised Fixtures button poke above the bar without being clipped.
          overflow: 'visible',
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: { backgroundColor: theme.colors.bg },
        headerRight: renderHeaderHome,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Squad', tabBarIcon: tabIcon('👥') }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup', tabBarIcon: tabIcon('📋') }} />
      <Tabs.Screen name="fixtures" options={{ title: 'Fixtures', tabBarButton: renderFixturesButton }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: tabIcon('💰') }} />
      <Tabs.Screen name="table" options={{ title: 'Table', tabBarIcon: tabIcon('🏆') }} />
    </Tabs>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
  fabPressed: { opacity: 0.85 },
  fab: {
    position: 'absolute',
    top: -22,
    left: '50%',
    transform: [{ translateX: -27 }], // half the width, so the circle is exactly centred
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    // Ring matches the fill until the tab is active, so toggling it doesn't resize the circle.
    borderWidth: 3,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabFocused: { borderColor: theme.colors.accent },
  fabIcon: { fontSize: 24 },
  fabLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
});
