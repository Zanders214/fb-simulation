import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { theme } from '../../src/theme';

function tabIcon(emoji: string) {
  return () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

function HeaderHomeButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.dismissTo('/')} hitSlop={10} style={{ paddingHorizontal: 14 }}>
      <Text style={{ color: theme.colors.onPrimary, fontSize: 22 }}>⌂</Text>
    </Pressable>
  );
}

const renderHeaderHome = () => <HeaderHomeButton />;

export default function SeasonLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primaryDark },
        headerTintColor: theme.colors.onPrimary,
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
