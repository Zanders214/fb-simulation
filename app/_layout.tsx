import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackHeaderBackProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeaderBackButton } from '../src/components/HeaderBackButton';
import { ThemeProvider, useTheme } from '../src/theme';

const renderHeaderBack = (props: NativeStackHeaderBackProps) => <HeaderBackButton {...props} />;
const renderNoHeaderLeft = () => null;

// Static per-screen options hoisted to module scope (no render-scope deps).
const NEW_GAME_OPTIONS = { title: 'New Game' } as const;
const INDEX_OPTIONS = { headerShown: false } as const;
const SEASON_OPTIONS = { headerShown: false } as const;
const MATCH_OPTIONS = {
  title: 'Match Result',
  headerBackVisible: false,
  headerLeft: renderNoHeaderLeft,
} as const;
const CALENDAR_OPTIONS = { title: 'Calendar' } as const;
const PLAYER_OPTIONS = { title: 'Player' } as const;
const CLUB_OPTIONS = { title: 'Club Stats' } as const;
const TRAINING_OPTIONS = { title: 'Training' } as const;
const ROLES_OPTIONS = { title: 'Roles' } as const;
const SETTINGS_OPTIONS = { title: 'Settings' } as const;

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

  const screenOptions = useMemo(
    () => ({
      orientation: 'portrait' as const,
      headerStyle: { backgroundColor: headerBg },
      headerTintColor: headerText,
      headerTitleStyle: { fontWeight: '700' as const },
      headerLeft: renderHeaderBack,
      contentStyle: { backgroundColor: theme.colors.bg },
    }),
    [headerBg, headerText, theme.colors.bg],
  );

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={INDEX_OPTIONS} />
        <Stack.Screen name="new-game" options={NEW_GAME_OPTIONS} />
        <Stack.Screen name="season" options={SEASON_OPTIONS} />
        <Stack.Screen name="match" options={MATCH_OPTIONS} />
        <Stack.Screen name="calendar" options={CALENDAR_OPTIONS} />
        <Stack.Screen name="player" options={PLAYER_OPTIONS} />
        <Stack.Screen name="club" options={CLUB_OPTIONS} />
        <Stack.Screen name="training" options={TRAINING_OPTIONS} />
        <Stack.Screen name="roles" options={ROLES_OPTIONS} />
        <Stack.Screen name="settings" options={SETTINGS_OPTIONS} />
      </Stack>
    </>
  );
}
