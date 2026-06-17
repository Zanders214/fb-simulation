import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { ordinal } from '../../ui/format';
import { useThemedStyles, type Theme } from '../../theme';
import { FormRow, HomeBadge, venueLabel, type LayoutProps } from './shared';

export function ProgrammeHome({ data, nav, insets, theme }: Readonly<LayoutProps>) {
  const styles = useThemedStyles(makeStyles);
  const contentStyle = useMemo(
    () => [styles.content, { paddingTop: insets.top + 16 }],
    [styles, insets.top],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={contentStyle}>
      <View style={styles.masthead}>
        <Text style={styles.mastheadTitle}>FB Simulation</Text>
        <Text style={styles.mastheadNo}>{`NO. ${data.matchday}`}</Text>
      </View>

      <Text style={styles.kicker} numberOfLines={1}>{`Season ${data.seasonNumber} · ${data.leagueName}`}</Text>
      <Text style={styles.title}>{`Matchday ${data.matchday}`}</Text>

      {data.opponent ? (
        <>
          <View style={styles.fixture}>
            <View style={styles.fixtureSide}>
              <HomeBadge club={data.club} size={48} radius={24} font={theme.fonts.heading} />
              <Text style={styles.fixtureTeam} numberOfLines={1}>{data.club.name}</Text>
            </View>
            <Text style={styles.v}>v</Text>
            <View style={styles.fixtureSide}>
              <HomeBadge club={data.opponent} size={48} radius={24} font={theme.fonts.heading} />
              <Text style={styles.fixtureTeam} numberOfLines={1}>{data.opponent.name}</Text>
            </View>
          </View>
          <Text style={styles.venue}>{`${venueLabel(data.isHome)} · MATCHDAY ${data.matchday}`}</Text>
        </>
      ) : (
        <Text style={styles.venue}>SEASON COMPLETE</Text>
      )}

      <View style={styles.rule} />

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.position > 0 ? ordinal(data.position) : '—'}</Text>
          <Text style={styles.statLabel}>POSITION</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.points}</Text>
          <Text style={styles.statLabel}>POINTS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={styles.formWrap}>
            <FormRow form={data.form} />
          </View>
          <Text style={styles.statLabel}>FORM</Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <Button label={`Continue to Matchday ${data.matchday}`} onPress={nav.onContinue} testID="home-continue" />
      <View style={styles.footer}>
        <Pressable onPress={nav.onSquad} accessibilityRole="button">
          <Text style={styles.footerLink}>Squad</Text>
        </Pressable>
        <Pressable onPress={nav.onMarket} accessibilityRole="button">
          <Text style={styles.footerLink}>Market</Text>
        </Pressable>
        <Pressable onPress={nav.onSettings} accessibilityRole="button">
          <Text style={styles.footerLink}>Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.bg },
    content: { flexGrow: 1, paddingHorizontal: theme.spacing(3.5), paddingBottom: theme.spacing(4) },
    masthead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.text,
      paddingBottom: theme.spacing(1.25),
    },
    mastheadTitle: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 20, letterSpacing: 0.3 },
    mastheadNo: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

    kicker: { color: theme.colors.accent, fontFamily: theme.fonts.body, fontSize: 12, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center', marginTop: theme.spacing(4) },
    title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 52, textAlign: 'center', marginTop: theme.spacing(1) },

    fixture: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(2.5), marginTop: theme.spacing(4) },
    fixtureSide: { alignItems: 'center', gap: theme.spacing(1) },
    fixtureTeam: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16 },
    v: { color: theme.colors.accent, fontFamily: theme.fonts.heading, fontSize: 22, fontStyle: 'italic' },
    venue: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, letterSpacing: 1, textAlign: 'center', marginTop: theme.spacing(1.5) },

    rule: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing(3) },

    statRow: { flexDirection: 'row', alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center', gap: theme.spacing(0.5) },
    statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: theme.colors.border },
    statValue: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: 26 },
    formWrap: { height: 30, justifyContent: 'center' },
    statLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1 },

    spacer: { flexGrow: 1, minHeight: theme.spacing(3) },
    footer: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing(3), marginTop: theme.spacing(1.5) },
    footerLink: { color: theme.colors.primary, fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  });
