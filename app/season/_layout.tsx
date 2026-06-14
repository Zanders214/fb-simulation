import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTheme } from '../../src/theme';

function tabIcon(emoji: string) {
  const Icon = () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
  Icon.displayName = `TabIcon-${emoji}`;
  return Icon;
}

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
  const headerBg = theme.dark ? theme.colors.primaryDark : theme.colors.surface;
  const headerText = theme.dark ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerText,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: { backgroundColor: theme.colors.bg },
        headerRight: renderHeaderHome,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Squad', tabBarIcon: tabIcon('👥') }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup', tabBarIcon: tabIcon('📋') }} />
      <Tabs.Screen name="roles" options={{ title: 'Roles', tabBarIcon: tabIcon('⭐') }} />
      <Tabs.Screen name="fixtures" options={{ title: 'Fixtures', tabBarIcon: tabIcon('📅') }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: tabIcon('💰') }} />
      <Tabs.Screen name="table" options={{ title: 'Table', tabBarIcon: tabIcon('🏆') }} />
    </Tabs>
  );
}
