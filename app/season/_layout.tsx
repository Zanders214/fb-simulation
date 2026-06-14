import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';

function tabIcon(emoji: string) {
  const Icon = () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
  Icon.displayName = `TabIcon-${emoji}`;
  return Icon;
}

/**
 * Fixtures is the heart of a season, so its tab gets a slightly larger, round
 * accent badge that stands out from the plain emoji icons on either side. It
 * sits in the middle of the five tabs.
 */
function FixturesTabIcon({ focused }: Readonly<{ focused: boolean }>) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.colors.accent : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: focused ? theme.colors.accent : theme.colors.border,
      }}
    >
      <Text style={{ fontSize: 22 }}>📅</Text>
    </View>
  );
}
const renderFixturesIcon = ({ focused }: { focused: boolean }) => <FixturesTabIcon focused={focused} />;

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
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: { backgroundColor: theme.colors.bg },
        headerRight: renderHeaderHome,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Squad', tabBarIcon: tabIcon('👥') }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup', tabBarIcon: tabIcon('📋') }} />
      <Tabs.Screen name="fixtures" options={{ title: 'Fixtures', tabBarIcon: renderFixturesIcon }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: tabIcon('💰') }} />
      <Tabs.Screen name="table" options={{ title: 'Table', tabBarIcon: tabIcon('🏆') }} />
    </Tabs>
  );
}
