import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

/**
 * Root navigation. Screens are locked to PORTRAIT by default (the game is
 * primarily vertical); individual screens (e.g. the league table) can opt into
 * landscape by overriding `orientation` in their own Stack.Screen options.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          orientation: 'portrait',
          headerStyle: { backgroundColor: theme.colors.primaryDark },
          headerTintColor: theme.colors.onPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="new-game" options={{ title: 'New Game' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
