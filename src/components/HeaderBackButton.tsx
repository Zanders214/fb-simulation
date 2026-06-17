import { useCallback } from 'react';
import { HeaderBackButton as NavHeaderBackButton } from '@react-navigation/elements';
import type { NativeStackHeaderBackProps } from '@react-navigation/native-stack';
import { useRouter } from 'expo-router';

/**
 * React Navigation's standard back button (chevron + previous-screen label),
 * but driven by `router.back()` instead of the native stack's own button.
 *
 * On iOS with the New Architecture the *native* stack back button stops
 * responding after push -> back -> push again when an intermediate screen hides
 * its header (software-mansion/react-native-screens#3294). Every screen here is
 * reached through `index`/`season`, both header-less, so the native button is
 * unreliable. Rendering the JS back button keeps the familiar look while using
 * `router.back()`, which still works (same path as the swipe-back gesture).
 */
export function HeaderBackButton(props: Readonly<NativeStackHeaderBackProps>) {
  const router = useRouter();
  const onPress = useCallback(() => router.back(), [router]);
  if (!router.canGoBack()) return null;
  return <NavHeaderBackButton {...props} onPress={onPress} />;
}
