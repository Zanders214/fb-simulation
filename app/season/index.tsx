import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Meta } from '../../src/components/Meta';
import { PlayerRow } from '../../src/components/PlayerRow';
import { leagueTable } from '../../src/engine';
import { useGame } from '../../src/store/gameStore';
import { squadByPosition, userClub } from '../../src/store/selectors';
import { flagFor, ordinal } from '../../src/ui/format';
import { useThemedStyles, type Theme } from '../../src/theme';

export default function SquadScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const summary = useMemo(() => {
    if (!game) return null;
    const table = leagueTable(game);
    const pos = table.findIndex((r) => r.clubId === game.managedClubId) + 1;
    const row = table.find((r) => r.clubId === game.managedClubId);
    const league = game.world.leagues[game.season.leagueId];
    return { pos, row, league, groups: squadByPosition(game, game.managedClubId), club: userClub(game) };
  }, [game]);

  if (!game || !summary) return <Redirect href="/" />;
  const { club, pos, row, league, groups } = summary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Chip label={club.shortName} color={club.primaryColor} />
          <Text style={styles.clubName} numberOfLines={1}>
            {club.name}
          </Text>
        </View>
        <Text style={styles.leagueLine} numberOfLines={1}>
          {league.name}{league.tier === 1 ? ' · Top flight' : ` · Tier ${league.tier}`}
        </Text>
        <View style={styles.metaRow}>
          <Meta label="Season" value={`${game.season.number}`} />
          <Meta label="Position" value={pos > 0 ? ordinal(pos) : '–'} />
          <Meta label="Record" value={row ? `${row.won}-${row.drawn}-${row.lost}` : '0-0-0'} />
          <Meta label="Points" value={`${row?.points ?? 0}`} />
        </View>
        <Pressable
          onPress={() => router.push('/club')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.clubStatsBtn, pressed && styles.clubStatsBtnPressed]}
        >
          <Text style={styles.clubStatsText}>Club stats ›</Text>
        </Pressable>
      </Card>

      {groups.map(({ position, players }) => (
        <View key={position} style={styles.group}>
          <Text style={styles.groupTitle}>{positionName(position)}</Text>
          <Card style={styles.groupCard}>
            {players.map((p) => {
              const inXI = game.squad.startingXI.includes(p.id);
              const subtitle =
                p.seasonApps > 0
                  ? `${p.seasonGoals}G ${p.seasonAssists}A · ${p.seasonApps} apps`
                  : `Age ${p.age} · ${flagFor(p.nationality)}`;
              return (
                <PlayerRow
                  key={p.id}
                  player={p}
                  subtitle={subtitle}
                  selected={inXI}
                  onPress={() => router.push(`/player?id=${p.id}`)}
                />
              );
            })}
          </Card>
        </View>
      ))}
      <Text style={styles.hint}>Players in your starting XI are highlighted. Edit them in Lineup.</Text>
    </ScrollView>
  );
}

function positionName(p: string): string {
  return { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' }[p] ?? p;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  clubName: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', flex: 1 },
  leagueLine: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  clubStatsBtn: {
    marginTop: theme.spacing(0.5),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
  },
  clubStatsBtnPressed: { opacity: 0.7 },
  clubStatsText: { color: theme.colors.accent, fontSize: theme.font.small, fontWeight: '800' },
  group: { gap: theme.spacing(0.75) },
  groupTitle: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing(0.5) },
  groupCard: { gap: theme.spacing(0.25), paddingVertical: theme.spacing(1) },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', marginTop: theme.spacing(1) },
});
