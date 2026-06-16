import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { overall, type Player } from '../engine';
import { useThemedStyles, type Theme } from '../theme';
import { availabilityColor, playerAvailability, positionColor } from '../ui/format';
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
          onSelect={onSelect}
          onLongPressPlayer={onLongPressPlayer}
        />
      ))}
    </View>
  );
}

function Marker({
  slot,
  player,
  selected,
  onSelect,
  onLongPressPlayer,
}: Readonly<{
  slot: FormationSlot;
  player: Player;
  selected?: boolean;
  onSelect?: (playerId: string) => void;
  onLongPressPlayer?: (playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const playerId = player.id;
  const handlePress = useCallback(() => onSelect?.(playerId), [onSelect, playerId]);
  const handleLongPress = useCallback(() => onLongPressPlayer?.(playerId), [onLongPressPlayer, playerId]);
  const onPress = onSelect ? handlePress : undefined;
  const onLongPress = onLongPressPlayer ? handleLongPress : undefined;
  const wrap = useMemo(
    () => [
      styles.marker,
      { left: `${slot.x * 100}%` as const, top: `${slot.y * 100}%` as const },
    ],
    [styles, slot.x, slot.y],
  );
  const shirt = [
    styles.shirt,
    { backgroundColor: positionColor(player.position) },
    selected && styles.shirtSelected,
  ];
  const availability = playerAvailability(player);
  const body = (
    <>
      <View style={shirt}>
        <Text style={styles.shirtLabel}>{slot.label}</Text>
        {availability && (
          <View style={[styles.statusDot, { backgroundColor: availabilityColor(availability.kind) }]}>
            <Text style={styles.statusDotText}>{availability.kind === 'injured' ? '✚' : '⊘'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {player.lastName}
      </Text>
      <Text style={styles.ovr}>{overall(player)}</Text>
    </>
  );

  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [...wrap, pressed && styles.pressed],
    [wrap, styles],
  );

  if (!onPress && !onLongPress) return <View style={wrap}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${slot.label}: ${player.name}`}
      style={pressableStyle}
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
  statusDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  statusDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },
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
