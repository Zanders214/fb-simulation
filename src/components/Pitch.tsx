import { Pressable, StyleSheet, Text, View } from 'react-native';
import { overall, type Player } from '../engine';
import { useThemedStyles, type Theme } from '../theme';
import { positionColor } from '../ui/format';
import type { FormationSlot } from '../ui/formationLayout';

/** One starting slot paired with the player currently occupying it. */
export interface PitchSlot {
  slot: FormationSlot;
  player: Player;
}

/**
 * A portrait football pitch that renders the starting XI in their formation
 * positions. Tapping a marker selects it (handled by the parent), which is how
 * editing happens directly on the lineup.
 */
export function Pitch({
  slots,
  selectedId,
  onSelect,
  onLongPressPlayer,
}: Readonly<{
  slots: PitchSlot[];
  selectedId?: string | null;
  onSelect?: (playerId: string) => void;
  onLongPressPlayer?: (playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pitch}>
      {/* field markings */}
      <View style={styles.halfway} />
      <View style={styles.centerCircle} />
      <View style={[styles.box, styles.boxTop]} />
      <View style={[styles.box, styles.boxBottom]} />

      {slots.map(({ slot, player }) => (
        <Marker
          key={player.id}
          slot={slot}
          player={player}
          selected={selectedId === player.id}
          onPress={onSelect ? () => onSelect(player.id) : undefined}
          onLongPress={onLongPressPlayer ? () => onLongPressPlayer(player.id) : undefined}
        />
      ))}
    </View>
  );
}

function Marker({
  slot,
  player,
  selected,
  onPress,
  onLongPress,
}: Readonly<{
  slot: FormationSlot;
  player: Player;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const wrap = [
    styles.marker,
    { left: `${slot.x * 100}%` as const, top: `${slot.y * 100}%` as const },
  ];
  const shirt = [
    styles.shirt,
    { backgroundColor: positionColor(player.position) },
    selected && styles.shirtSelected,
  ];
  const body = (
    <>
      <View style={shirt}>
        <Text style={styles.shirtLabel}>{slot.label}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {player.lastName}
      </Text>
      <Text style={styles.ovr}>{overall(player)}</Text>
    </>
  );

  if (!onPress && !onLongPress) return <View style={wrap}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${slot.label}: ${player.name}`}
      style={({ pressed }) => [...wrap, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const MARKER_W = 60;

const makeStyles = (theme: Theme) => StyleSheet.create({
  pitch: {
    width: '100%',
    aspectRatio: 0.74,
    backgroundColor: theme.colors.field,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  halfway: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 92,
    height: 92,
    marginLeft: -46,
    marginTop: -46,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  box: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    height: '14%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  boxTop: { top: 0, borderTopWidth: 0 },
  boxBottom: { bottom: 0, borderBottomWidth: 0 },
  marker: {
    position: 'absolute',
    width: MARKER_W,
    marginLeft: -MARKER_W / 2,
    marginTop: -MARKER_W / 2,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
  shirt: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  shirtSelected: { borderColor: theme.colors.accent, borderWidth: 3 },
  shirtLabel: { color: theme.colors.onPrimary, fontWeight: '900', fontSize: theme.font.small },
  name: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ovr: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
