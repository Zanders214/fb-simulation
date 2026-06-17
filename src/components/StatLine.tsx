import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

/** A single key/value row: muted label on the left, bold value on the right. */
// Memoised: a primitive-prop leaf often rendered many times per screen.
export const StatLine = memo(function StatLine({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: theme.font.body },
  statValue: { color: theme.colors.text, fontFamily: theme.fonts.numeric, fontSize: theme.font.body, fontWeight: '800' },
});
