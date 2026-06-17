import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

/** A small centered stat tile: a bold value over a muted caption. */
export function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.meta}>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  meta: { alignItems: 'center', flex: 1 },
  metaValue: { color: theme.colors.text, fontFamily: theme.fonts.numeric, fontSize: theme.font.body, fontWeight: '800' },
  metaLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: theme.font.small, marginTop: 2 },
});
