import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { overall, type Player } from '../engine';
import { flagFor, formColor, formSymbol, overallColor, positionColor } from '../ui/format';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { Chip } from './Chip';

export function PlayerRow({
  player,
  onPress,
  onLongPress,
  selected,
  subtitle,
  right,
}: Readonly<{
  player: Player;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  subtitle?: string;
  right?: ReactNode;
}>) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ovr = overall(player);
  const body = (
    <>
      <Chip label={player.position} color={positionColor(player.position)} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle ?? `Age ${player.age} · ${flagFor(player.nationality)}`}
        </Text>
      </View>
      {right ?? (
        <View style={styles.stat}>
          <Text style={[styles.ovr, { color: overallColor(ovr, theme) }]}>{ovr}</Text>
          <Text style={[styles.form, { color: formColor(player.form, theme) }]}>{formSymbol(player.form)}</Text>
        </View>
      )}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, selected && styles.selected]}>{body}</View>;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(1),
    borderRadius: theme.radius.sm,
  },
  selected: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accent },
  pressed: { opacity: 0.6 },
  info: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  sub: { color: theme.colors.textMuted, fontSize: theme.font.small },
  stat: { alignItems: 'center', minWidth: 38 },
  ovr: { fontSize: theme.font.body, fontWeight: '800' },
  form: { fontSize: theme.font.small },
});
