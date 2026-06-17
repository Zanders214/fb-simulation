import { useCallback, useMemo } from 'react';
import type { BottomTabBarButtonProps, BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTheme, useThemedStyles, type Theme } from '../../src/theme';

const tabIconStyle = { fontSize: 18 } as const;

function tabIcon(emoji: string) {
  const Icon = () => <Text style={tabIconStyle}>{emoji}</Text>;
  Icon.displayName = `TabIcon-${emoji}`;
  return Icon;
}

// Per-tab options are static (icons built from a fixed emoji), so hoist them.
const SQUAD_TAB_OPTIONS = { title: 'Squad', tabBarIcon: tabIcon('👥') } as const;
const LINEUP_TAB_OPTIONS = { title: 'Lineup', tabBarIcon: tabIcon('📋') } as const;
const MARKET_TAB_OPTIONS = { title: 'Market', tabBarIcon: tabIcon('💰') } as const;
const TABLE_TAB_OPTIONS = { title: 'Table', tabBarIcon: tabIcon('🏆') } as const;

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
  const wrapStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [styles.fabWrap, pressed && styles.fabPressed],
    [styles],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      style={wrapStyle}
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
const FIXTURES_TAB_OPTIONS = { title: 'Fixtures', tabBarButton: renderFixturesButton } as const;

// Season tabs have no back button — the ⌂ home shortcut is the escape hatch.
const renderTabHeader = ({ options }: BottomTabHeaderProps) => (
  <ScreenHeader title={options.title ?? ''} showBack={false} showHome />
);

export default function SeasonLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const screenOptions = useMemo(
    () => ({
      header: renderTabHeader,
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
        height: 60 + insets.bottom,
        paddingTop: 6,
        paddingBottom: insets.bottom,
        // Let the raised Fixtures button poke above the bar without being clipped.
        overflow: 'visible' as const,
      },
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.textMuted,
      sceneStyle: { backgroundColor: theme.colors.bg },
    }),
    [
      theme.colors.surface,
      theme.colors.border,
      theme.colors.accent,
      theme.colors.textMuted,
      theme.colors.bg,
      insets.bottom,
    ],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={SQUAD_TAB_OPTIONS} />
      <Tabs.Screen name="lineup" options={LINEUP_TAB_OPTIONS} />
      <Tabs.Screen name="fixtures" options={FIXTURES_TAB_OPTIONS} />
      <Tabs.Screen name="market" options={MARKET_TAB_OPTIONS} />
      <Tabs.Screen name="table" options={TABLE_TAB_OPTIONS} />
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
