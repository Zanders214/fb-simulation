import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Meta } from '../src/components/Meta';
import { RecordTable } from '../src/components/RecordTable';
import { Section } from '../src/components/Section';
import { StatLine } from '../src/components/StatLine';
import { clubRanking, clubRecords, rankingFraction, type Movement } from '../src/engine';
import { useGame } from '../src/store/gameStore';
import { flagFor, formatMoney, ordinal } from '../src/ui/format';
import { useThemedStyles, type Theme } from '../src/theme';

/** Up/down/level arrow for a season's promotion-relegation outcome. */
function movementSymbol(movement?: Movement): string {
  if (movement === 'promoted') return '↑';
  if (movement === 'relegated') return '↓';
  return '–';
}

export default function ClubScreen() {
  const game = useGame();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clubId = id ?? game?.managedClubId;
  const stats = useMemo(() => (game && clubId ? clubRecords(game, clubId) : null), [game, clubId]);
  const openPlayer = useCallback((pid: string) => router.push(`/player?id=${pid}`), [router]);

  if (!game || !clubId || !stats || !game.world.clubs[clubId]) return <Redirect href="/" />;
  const club = game.world.clubs[clubId];
  const country = game.world.leagues[club.leagueId]?.country ?? '';
  // Season history is the user's own career (finishes + promotion/relegation), so
  // only show it on their club's page — not when deep-linking to a rival club.
  const isUserClub = clubId === game.managedClubId;
  const history = isUserClub ? [...game.history].reverse() : []; // most recent season first

  const seasonDivision = (leagueId?: string, tier?: number): string => {
    const name = leagueId ? game.world.leagues[leagueId]?.name : undefined;
    if (name) return name;
    return tier ? `Tier ${tier}` : '—';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Chip label={club.shortName} color={club.primaryColor} />
          <Text style={styles.clubName} numberOfLines={1}>
            {club.name}
          </Text>
        </View>
        {country ? (
          <Text style={styles.countryLine} numberOfLines={1}>{`${flagFor(country)} ${country}`}</Text>
        ) : null}
        <View style={styles.rankingRow}>
          <Text style={styles.rankingLabel}>Ranking</Text>
          <View style={styles.rankingTrack}>
            <View style={[styles.rankingFill, { width: `${Math.round(rankingFraction(clubRanking(game.world, clubId)) * 100)}%` }]} />
          </View>
        </View>
        <View style={styles.metaRow}>
          <Meta label="Trophies" value={`${stats.trophies}`} />
          <Meta label="Seasons" value={`${stats.seasonsPlayed}`} />
          <Meta label="Best finish" value={stats.bestFinish > 0 ? ordinal(stats.bestFinish) : '–'} />
        </View>
      </Card>

      <Section title="Squad value">
        <Card style={styles.card}>
          <StatLine label="Current" value={formatMoney(stats.squadValue)} />
          <StatLine label="Highest ever" value={formatMoney(stats.peakSquadValue)} />
        </Card>
      </Section>

      {history.length > 0 && (
        <Section title="Season history">
          <Card style={styles.historyCard}>
            {history.map((h) => (
              <View key={h.season} style={styles.histRow}>
                <Text style={styles.histSeason}>S{h.season}</Text>
                <Text style={styles.histLeague} numberOfLines={1}>
                  {seasonDivision(h.leagueId, h.tier)}
                </Text>
                <Text style={styles.histPos}>{h.userPosition > 0 ? ordinal(h.userPosition) : '—'}</Text>
                <Text
                  style={[
                    styles.histMove,
                    h.movement === 'promoted' && styles.histPromoted,
                    h.movement === 'relegated' && styles.histRelegated,
                  ]}
                >
                  {movementSymbol(h.movement)}
                </Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      <RecordTable title="All-time Top Scorers" statLabel="G" entries={stats.topScorers} onPressRow={openPlayer} />
      <RecordTable title="All-time Top Assisters" statLabel="A" entries={stats.topAssisters} onPressRow={openPlayer} />
      <RecordTable title="All-time Most Cards" statLabel="Cards" entries={stats.mostCards} onPressRow={openPlayer} />
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(4) },
  header: { gap: theme.spacing(1.5) },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  clubName: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', flex: 1 },
  countryLine: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.25) },
  rankingLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  rankingTrack: { flex: 1, height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  rankingFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent },
  card: { gap: theme.spacing(1.25) },
  historyCard: { gap: theme.spacing(0.5) },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  histSeason: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700', minWidth: 28 },
  histLeague: { color: theme.colors.text, fontSize: theme.font.small, flex: 1 },
  histPos: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  histMove: { color: theme.colors.textMuted, fontSize: theme.font.body, fontWeight: '900', minWidth: 18, textAlign: 'center' },
  histPromoted: { color: theme.colors.win },
  histRelegated: { color: theme.colors.loss },
});
