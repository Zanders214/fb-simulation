import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ThemeProvider, useTheme } from '../src/theme';

// Every family the three styles can show. The names here are the font-family
// identifiers screens reference via `theme.fonts.*`.
const APP_FONTS = {
  BarlowCondensed_800ExtraBold,
  Barlow_400Regular,
  Barlow_600SemiBold,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  HankenGrotesk_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexSans_400Regular,
};

const renderStackHeader = ({ options }: NativeStackHeaderProps) => <ScreenHeader title={options.title ?? ''} />;
// Match is a result screen reached via a Play action — no back affordance.
const renderMatchHeader = ({ options }: NativeStackHeaderProps) => (
  <ScreenHeader title={options.title ?? ''} showBack={false} />
);

// Static per-screen options hoisted to module scope (no render-scope deps).
const NEW_GAME_OPTIONS = { title: 'New Game' } as const;
const INDEX_OPTIONS = { headerShown: false } as const;
const SEASON_OPTIONS = { headerShown: false } as const;
const MATCH_OPTIONS = { title: 'Match Result', header: renderMatchHeader } as const;
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
 * app — chrome included — live. The header is a custom `ScreenHeader` (rendered
 * via `screenOptions.header`) so each style gets its own banner treatment while
 * staying pinned like a native header. Render is gated on the brand fonts so the
 * first paint isn't a flash of system type.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  if (!fontsLoaded && !fontError) return null;
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
  const screenOptions = useMemo(
    () => ({
      orientation: 'portrait' as const,
      header: renderStackHeader,
      contentStyle: { backgroundColor: theme.colors.bg },
    }),
    [theme.colors.bg],
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
