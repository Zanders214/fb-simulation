import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../Button';
import { formatMoney, ordinal } from '../../ui/format';
import { useThemedStyles, type Theme } from '../../theme';
import { GRAD_START, GRAD_END, HomeBadge, venueLabel, type LayoutProps } from './shared';

export function BroadcastHome({ data, nav, insets, theme }: Readonly<LayoutProps>) {
  const styles = useThemedStyles(makeStyles);
  const gradient = useMemo(() => [theme.colors.primary, theme.colors.primaryDark] as const, [theme]);
  const bannerStyle = useMemo(() => [styles.banner, { paddingTop: insets.top + 12 }], [styles, insets.top]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBody}>
      <LinearGradient colors={gradient} start={GRAD_START} end={GRAD_END} style={bannerStyle}>
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>FB</Text>
            </View>
            <Text style={styles.brand}>FB SIMULATION</Text>
          </View>
          <Pressable onPress={nav.onSettings} hitSlop={10} accessibilityRole="button" accessibilityLabel="Settings">
            <Text style={styles.icon}>⚙</Text>
          </Pressable>
        </View>
        <Text style={styles.kicker} numberOfLines={1}>{`SEASON ${data.seasonNumber} · ${data.leagueName}`}</Text>
        <Text style={styles.title}>{`MATCHDAY ${data.matchday}`}</Text>

        {data.opponent ? (
          <View style={styles.fixture}>
            <View style={styles.fixtureSide}>
              <HomeBadge club={data.club} size={36} radius={9} font={theme.fonts.heading} />
              <Text style={styles.fixtureTeam} numberOfLines={1}>{data.club.name}</Text>
            </View>
            <View style={styles.fixtureMid}>
              <Text style={styles.vs}>VS</Text>
              <Text style={styles.vsSub}>{`${venueLabel(data.isHome)} · MD ${data.matchday}`}</Text>
            </View>
            <View style={styles.fixtureSide}>
              <HomeBadge club={data.opponent} size={36} radius={9} font={theme.fonts.heading} />
              <Text style={styles.fixtureTeam} numberOfLines={1}>{data.opponent.name}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.seasonDone}>SEASON COMPLETE</Text>
        )}
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOP SCORER</Text>
            <Text style={styles.statBig}>{data.topScorerGoals}</Text>
            <Text style={styles.statSub} numberOfLines={1}>{data.topScorerName ?? '—'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>BUDGET</Text>
            <Text style={styles.statBigGreen}>{formatMoney(data.budget)}</Text>
            <Text style={styles.statSub}>{`Squad ${data.squadSize}/${data.squadCap}`}</Text>
          </View>
        </View>

        {data.standingsWindow.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>STANDINGS</Text>
            <View style={styles.standRow}>
              {data.standingsWindow.map((row) => (
                <View key={row.club.id} style={[styles.standCell, row.isUser && styles.standCellUser]}>
                  <Text style={[styles.standRank, row.isUser && styles.standUserText]}>
                    {ordinal(row.rank).toUpperCase()}
                  </Text>
                  <Text style={[styles.standName, row.isUser && styles.standUserText]}>{row.club.shortName}</Text>
                  <Text style={[styles.standPts, row.isUser && styles.standUserText]}>{row.points}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Button label={`Matchday ${data.matchday}`} onPress={nav.onContinue} testID="home-continue" />

        <View style={styles.footer}>
          <Pressable onPress={nav.onSquad} accessibilityRole="button">
            <Text style={styles.footerLink}>Squad</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={nav.onMarket} accessibilityRole="button">
            <Text style={styles.footerLink}>Market</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable onPress={nav.onSettings} accessibilityRole="button">
            <Text style={styles.footerLink}>Settings</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.bg },
    scrollBody: { paddingBottom: theme.spacing(4) },
    banner: {
      paddingHorizontal: theme.spacing(3),
      paddingBottom: theme.spacing(3),
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.accent,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(2) },
    brandLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
    logo: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: { color: theme.colors.accent, fontFamily: theme.fonts.heading, fontSize: 13 },
    brand: { color: theme.colors.onPrimary, fontFamily: theme.fonts.heading, fontSize: 16, letterSpacing: 0.5 },
    icon: { color: theme.colors.onPrimary, fontSize: 18 },
    kicker: { color: theme.colors.accent, fontFamily: theme.fonts.numeric, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },
    title: { color: theme.colors.onPrimary, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 46, letterSpacing: 0.5, marginTop: 2 },
    seasonDone: { color: theme.colors.onPrimary, fontFamily: theme.fonts.heading, fontSize: 22, marginTop: theme.spacing(2) },

    fixture: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderRadius: theme.radius.lg,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
    },
    fixtureSide: { flex: 1, alignItems: 'center', gap: theme.spacing(0.75) },
    fixtureMid: { alignItems: 'center', paddingHorizontal: theme.spacing(1) },
    fixtureTeam: { color: theme.colors.onPrimary, fontFamily: theme.fonts.body, fontSize: 13 },
    vs: { color: theme.colors.accent, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 22 },
    vsSub: { color: theme.colors.onPrimary, fontFamily: theme.fonts.numeric, fontSize: 10, letterSpacing: 1, opacity: 0.75, marginTop: 2 },

    body: { padding: theme.spacing(2.5), gap: theme.spacing(2) },
    statRow: { flexDirection: 'row', gap: theme.spacing(1.5) },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.75),
    },
    statLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
    statBig: { color: theme.colors.accent, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 32, marginTop: theme.spacing(0.5) },
    statBigGreen: { color: theme.colors.win, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 32, marginTop: theme.spacing(0.5) },
    statSub: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 2 },

    sectionLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: theme.spacing(1) },
    standRow: { flexDirection: 'row', gap: theme.spacing(1) },
    standCell: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1),
      alignItems: 'center',
      gap: 2,
    },
    standCellUser: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.accent },
    standRank: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11, fontWeight: '700' },
    standName: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 15 },
    standPts: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11 },
    standUserText: { color: theme.colors.accent },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1.5) },
    footerLink: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600' },
    footerDot: { color: theme.colors.border },
  });
