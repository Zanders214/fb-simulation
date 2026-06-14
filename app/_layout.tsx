import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeaderBackButton } from '../src/components/HeaderBackButton';
import { theme } from '../src/theme';

const renderHeaderBack = () => <HeaderBackButton />;
const renderNoHeaderLeft = () => null;

/**
 * Root navigation. Screens are locked to PORTRAIT by default (the game is
 * primarily vertical); individual screens (e.g. the league table) can opt into
 * landscape by overriding `orientation` in their own Stack.Screen options.
 *
 * `headerLeft` is a custom JS back button on every screen — see HeaderBackButton
 * for why the native one can't be trusted here (react-native-screens#3294).
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
          headerLeft: renderHeaderBack,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="new-game" options={{ title: 'New Game' }} />
        <Stack.Screen name="season" options={{ headerShown: false }} />
        <Stack.Screen
          name="match"
          options={{ title: 'Match Result', headerBackVisible: false, headerLeft: renderNoHeaderLeft }}
        />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="player" options={{ title: 'Player' }} />
        <Stack.Screen name="training" options={{ title: 'Training' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
