import { useCallback, useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

const HIT_SLOP = 10;
const PRESSABLE_STYLE = { paddingHorizontal: 6 } as const;

/**
 * The ⌂ shortcut back to the main menu. Lives in the screen header on the season
 * tabs (which have no back button) and anywhere else the header wants a quick
 * escape hatch. `router.dismissTo('/')` unwinds the whole stack to Home.
 */
export function HeaderHomeButton({ color }: Readonly<{ color: string }>) {
  const router = useRouter();
  const goHome = useCallback(() => router.dismissTo('/'), [router]);
  const iconStyle = useMemo(() => ({ color, fontSize: 22 }), [color]);
  return (
    <Pressable onPress={goHome} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Home" style={PRESSABLE_STYLE}>
      <Text style={iconStyle}>⌂</Text>
    </Pressable>
  );
}
