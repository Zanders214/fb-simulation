import { Redirect } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { PlayerRow } from '../src/components/PlayerRow';
import type { Player, SquadRoles } from '../src/engine';
import { useGame, useGameStore } from '../src/store/gameStore';
import { useThemedStyles, type Theme } from '../src/theme';

const ROLES: { key: keyof SquadRoles; label: string }[] = [
  { key: 'captainId', label: 'Captain' },
  { key: 'penaltyTakerId', label: 'Penalty taker' },
  { key: 'freeKickTakerId', label: 'Free-kick taker' },
];

export default function RolesScreen() {
  const game = useGame();
  const styles = useThemedStyles(makeStyles);
  const assignRole = useGameStore((s) => s.assignRole);
  const [activeRole, setActiveRole] = useState<keyof SquadRoles>('captainId');

  if (!game) return <Redirect href="/" />;
  const { squad, world } = game;
  const xiPlayers = squad.startingXI.map((id) => world.players[id]).filter((p): p is Player => Boolean(p));
  const assignedId = squad.roles[activeRole];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.roleRow}>
        {ROLES.map((r) => {
          const player = squad.roles[r.key] ? world.players[squad.roles[r.key] as string] : undefined;
          return (
            <RoleTab
              key={r.key}
              roleKey={r.key}
              label={r.label}
              active={activeRole === r.key}
              assigneeName={player ? player.lastName : '—'}
              onSelect={setActiveRole}
            />
          );
        })}
      </View>

      <Text style={styles.hint}>Tap a player to assign them as {labelFor(activeRole).toLowerCase()}.</Text>

      <Card style={styles.listCard}>
        {xiPlayers.map((p) => (
          <RoleAssignRow
            key={p.id}
            player={p}
            selected={assignedId === p.id}
            activeRole={activeRole}
            onAssign={assignRole}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

function labelFor(key: keyof SquadRoles): string {
  return ROLES.find((r) => r.key === key)?.label ?? 'role';
}

// Memoised tab so each role owns a stable onPress (built from the stable
// setActiveRole + its own key) instead of a fresh inline closure per render.
const RoleTab = memo(function RoleTab({
  roleKey,
  label,
  active,
  assigneeName,
  onSelect,
}: Readonly<{
  roleKey: keyof SquadRoles;
  label: string;
  active: boolean;
  assigneeName: string;
  onSelect: (key: keyof SquadRoles) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const handlePress = useCallback(() => onSelect(roleKey), [onSelect, roleKey]);
  return (
    <Pressable onPress={handlePress} style={[styles.roleCard, active && styles.roleActive]}>
      <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{label}</Text>
      <Text style={styles.roleAssignee} numberOfLines={1}>
        {assigneeName}
      </Text>
    </Pressable>
  );
});

// Memoised list row: builds its own onPress (stable assignRole + active role +
// its player) and the ★ marker, so the map doesn't hand PlayerRow new closures.
const RoleAssignRow = memo(function RoleAssignRow({
  player,
  selected,
  activeRole,
  onAssign,
}: Readonly<{
  player: Player;
  selected: boolean;
  activeRole: keyof SquadRoles;
  onAssign: (role: keyof SquadRoles, playerId: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const handlePress = useCallback(
    () => onAssign(activeRole, player.id),
    [onAssign, activeRole, player.id],
  );
  const right = useMemo(
    () => (selected ? <Text style={styles.tick}>★</Text> : undefined),
    [selected, styles],
  );
  return <PlayerRow player={player} selected={selected} onPress={handlePress} right={right} />;
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  roleRow: { flexDirection: 'row', gap: theme.spacing(1) },
  roleCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(1.25),
    alignItems: 'center',
    gap: 2,
  },
  roleActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  roleLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700', textAlign: 'center' },
  roleLabelActive: { color: theme.colors.accent },
  roleAssignee: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600' },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  listCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  tick: { color: theme.colors.accent, fontSize: 18, minWidth: 38, textAlign: 'center' },
});
