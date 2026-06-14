import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

/** Small pill used for position tags, OVR values, roles, etc. */
export function Chip({
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
}

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
