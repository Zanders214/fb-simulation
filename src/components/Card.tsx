import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

export function Card({ children, style }: Readonly<{ children: ReactNode; style?: StyleProp<ViewStyle> }>) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    // Terminal squares its corners for a gridded, data-dense feel; the softer
    // styles round more generously.
    borderRadius: theme.style === 'terminal' ? theme.radius.sm : theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
  },
});
