import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

/** A labelled block: an uppercase muted heading above gapped content. */
export function Section({
  title,
  children,
  style,
}: Readonly<{ title: string; children: ReactNode; style?: StyleProp<ViewStyle> }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  section: { gap: theme.spacing(0.75) },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: theme.spacing(0.5),
  },
});
