import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { generateWorld, type ClubId, type LeagueId } from '../src/engine';
import { useGameStore } from '../src/store/gameStore';
import { useTheme, useThemedStyles, type Theme } from '../src/theme';

type Mode = 'create' | 'takeover';
type Step = 'mode' | 'league' | 'configure';

const COLOR_SWATCHES = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
  '#16a085', '#2c3e50', '#f1c40f', '#e84393', '#ecf0f1',
];

export default function NewGame() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const newGame = useGameStore((s) => s.newGame);

  // one fresh seed per visit; the engine regenerates this exact world on start
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000_000));
  const world = useMemo(() => generateWorld(seed), [seed]);

  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<Mode>('takeover');
  const [leagueId, setLeagueId] = useState<LeagueId | null>(null);

  const [clubId, setClubId] = useState<ClubId | null>(null);
  const [clubName, setClubName] = useState('');
  const [shortName, setShortName] = useState('');
  const [primary, setPrimary] = useState(COLOR_SWATCHES[1]);
  const [secondary, setSecondary] = useState(COLOR_SWATCHES[9]);

  const leagues = Object.values(world.leagues);

  const start = () => {
    if (!leagueId) return;
    if (mode === 'takeover' && clubId) {
      newGame({ leagueId, mode: 'takeover', takeoverClubId: clubId }, seed);
    } else if (mode === 'create' && clubName.trim()) {
      newGame(
        {
          leagueId,
          mode: 'create',
          newClub: {
            name: clubName.trim(),
            shortName: (shortName || clubName).slice(0, 3).toUpperCase(),
            primaryColor: primary,
            secondaryColor: secondary,
          },
        },
        seed,
      );
    } else {
      return;
    }
    router.replace('/season');
  };

  const canStart = mode === 'takeover' ? !!clubId : clubName.trim().length >= 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {step === 'mode' && (
        <>
          <Text style={styles.h}>How do you want to start?</Text>
          <Pressable onPress={() => { setMode('create'); setStep('league'); }}>
            <Card style={styles.optionCard}>
              <Text style={styles.optTitle}>Create a new club</Text>
              <Text style={styles.optDesc}>Name and colour a brand-new club that joins a league as the newcomer.</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => { setMode('takeover'); setStep('league'); }}>
            <Card style={styles.optionCard}>
              <Text style={styles.optTitle}>Take over an existing club</Text>
              <Text style={styles.optDesc}>Pick one of the league's clubs and manage its current squad.</Text>
            </Card>
          </Pressable>
        </>
      )}

      {step === 'league' && (
        <>
          <Text style={styles.h}>Choose a league</Text>
          {leagues.map((lg) => (
            <Pressable
              key={lg.id}
              onPress={() => { setLeagueId(lg.id); setClubId(null); setStep('configure'); }}
            >
              <Card style={styles.optionCard}>
                <Text style={styles.optTitle}>{lg.name}</Text>
                <Text style={styles.optDesc}>{lg.country} · {lg.clubIds.length} clubs</Text>
              </Card>
            </Pressable>
          ))}
          <Button label="Back" variant="ghost" onPress={() => setStep('mode')} style={styles.mt} />
        </>
      )}

      {step === 'configure' && leagueId && mode === 'takeover' && (
        <>
          <Text style={styles.h}>Pick your club</Text>
          {world.leagues[leagueId].clubIds
            .map((id) => world.clubs[id])
            .sort((a, b) => b.reputation - a.reputation)
            .map((club) => {
              const selected = clubId === club.id;
              return (
                <Pressable key={club.id} onPress={() => setClubId(club.id)}>
                  <Card style={[styles.clubRow, selected && styles.clubSelected]}>
                    <Chip label={club.shortName} color={club.primaryColor} />
                    <View style={styles.clubInfo}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${club.reputation}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.rep}>{club.reputation}</Text>
                  </Card>
                </Pressable>
              );
            })}
          <Button label="Start career" onPress={start} disabled={!canStart} style={styles.mt} testID="start-career" />
          <Button label="Back" variant="ghost" onPress={() => setStep('league')} />
        </>
      )}

      {step === 'configure' && leagueId && mode === 'create' && (
        <>
          <Text style={styles.h}>Create your club</Text>
          <Card>
            <Text style={styles.fieldLabel}>Club name</Text>
            <TextInput
              value={clubName}
              onChangeText={(t) => { setClubName(t); if (!shortName) setShortName(t.slice(0, 3).toUpperCase()); }}
              placeholder="e.g. Riverside United"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              maxLength={24}
              testID="club-name"
            />
            <Text style={styles.fieldLabel}>Short code (3 letters)</Text>
            <TextInput
              value={shortName}
              onChangeText={(t) => setShortName(t.toUpperCase().slice(0, 3))}
              placeholder="RIV"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              autoCapitalize="characters"
              maxLength={3}
            />
            <Text style={styles.fieldLabel}>Primary colour</Text>
            <Swatches selected={primary} onSelect={setPrimary} />
            <Text style={styles.fieldLabel}>Secondary colour</Text>
            <Swatches selected={secondary} onSelect={setSecondary} />
          </Card>
          <Button label="Start career" onPress={start} disabled={!canStart} style={styles.mt} testID="start-career" />
          <Button label="Back" variant="ghost" onPress={() => setStep('league')} />
        </>
      )}
    </ScrollView>
  );
}

function Swatches({ selected, onSelect }: Readonly<{ selected: string; onSelect: (c: string) => void }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.swatches}>
      {COLOR_SWATCHES.map((c) => (
        <Pressable
          key={c}
          onPress={() => onSelect(c)}
          style={[styles.swatch, { backgroundColor: c }, selected === c && styles.swatchSelected]}
        />
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), paddingBottom: theme.spacing(6) },
  h: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '700', marginBottom: theme.spacing(0.5) },
  optionCard: { gap: theme.spacing(0.5) },
  optTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  optDesc: { color: theme.colors.textMuted, fontSize: theme.font.small },
  mt: { marginTop: theme.spacing(1) },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  clubSelected: { borderColor: theme.colors.accent },
  clubInfo: { flex: 1, gap: theme.spacing(0.75) },
  clubName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  barTrack: { height: 6, backgroundColor: theme.colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: theme.colors.primary },
  rep: { color: theme.colors.textMuted, fontSize: theme.font.body, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  fieldLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.spacing(1), marginBottom: theme.spacing(0.5) },
  input: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    fontSize: theme.font.body,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) },
  swatch: { width: 36, height: 36, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: theme.colors.text },
});
