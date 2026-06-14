import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackHeaderBackProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeaderBackButton } from '../src/components/HeaderBackButton';
import { ThemeProvider, useTheme } from '../src/theme';

const renderHeaderBack = (props: NativeStackHeaderBackProps) => <HeaderBackButton {...props} />;
const renderNoHeaderLeft = () => null;

/**
 * Root navigation. Screens are locked to PORTRAIT by default (the game is
 * primarily vertical); individual screens (e.g. the league table) can opt into
 * landscape by overriding `orientation` in their own Stack.Screen options.
 *
 * Everything sits inside <ThemeProvider> so the active theme re-skins the whole
 * app (including navigation chrome) live. `headerLeft` is a custom JS back button
 * on every screen — see HeaderBackButton for why the native one can't be trusted
 * here (react-native-screens#3294).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  // Light themes get light chrome (dark header text + dark status icons); dark
  // themes keep the branded dark header with light text.
  const headerBg = theme.dark ? theme.colors.primaryDark : theme.colors.surface;
  const headerText = theme.dark ? theme.colors.onPrimary : theme.colors.text;

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          orientation: 'portrait',
          headerStyle: { backgroundColor: headerBg },
          headerTintColor: headerText,
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
        <Stack.Screen name="club" options={{ title: 'Club Stats' }} />
        <Stack.Screen name="training" options={{ title: 'Training' }} />
        <Stack.Screen name="roles" options={{ title: 'Roles' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
