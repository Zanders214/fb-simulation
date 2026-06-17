import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameState } from '../../engine';
import { useTheme } from '../../theme';
import { BroadcastHome } from './BroadcastHome';
import { buildHomeData, type HomeData } from './homeData';
import { ProgrammeHome } from './ProgrammeHome';
import { TerminalHome } from './TerminalHome';
import type { HomeNav } from './shared';

/**
 * The matchday Home dashboard. Reads `theme.style` and renders the matching
 * composition (Broadcast hero / Programme cover / Terminal dashboard), all fed
 * from one `buildHomeData(game)`. The primary CTA continues into the season hub.
 */
export function MatchdayHome({ game }: Readonly<{ game: GameState }>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data: HomeData = useMemo(() => buildHomeData(game), [game]);
  const nav: HomeNav = useMemo(
    () => ({
      onContinue: () => router.push('/season'),
      onSquad: () => router.push('/season'),
      onMarket: () => router.push('/season/market'),
      onTable: () => router.push('/season/table'),
      onSettings: () => router.push('/settings'),
    }),
    [router],
  );
  const props = { data, nav, insets, theme };
  if (theme.style === 'programme') return <ProgrammeHome {...props} />;
  if (theme.style === 'terminal') return <TerminalHome {...props} />;
  return <BroadcastHome {...props} />;
}
