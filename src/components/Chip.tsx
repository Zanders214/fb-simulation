import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

/** Small pill used for position tags, OVR values, roles, etc. */
// Memoised: rendered once per PlayerRow (and in many lists) with primitive-only
// props, so it can safely skip re-rendering when a parent list re-renders.
export const Chip = memo(function Chip({
  label,
  color,
  textColor,
}: Readonly<{
  label: string;
  color?: string;
  textColor?: string;
}>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.chip, color ? { backgroundColor: color } : null]}>
      <Text style={[styles.text, textColor ? { color: textColor } : null]}>{label}</Text>
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  chip: {
    minWidth: 34,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
});
