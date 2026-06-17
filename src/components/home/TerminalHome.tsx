import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { formatMoney } from '../../ui/format';
import { useThemedStyles, type Theme } from '../../theme';
import { FormRow, gdText, HomeBadge, type LayoutProps } from './shared';

/** `Riverside United` → `RIVERSIDE_UTD`-style code line. */
function clubCode(name: string): string {
  return name.toUpperCase().replace(/\s+/g, '_');
}

export function TerminalHome({ data, nav, insets, theme }: Readonly<LayoutProps>) {
  const styles = useThemedStyles(makeStyles);
  const headerStyle = useMemo(() => [styles.header, { paddingTop: insets.top + 10 }], [styles, insets.top]);
  const league = data.leagueName.split(' ')[0].toUpperCase();
  const badgeFont = theme.fonts.numeric;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBody}>
      <View style={headerStyle}>
        <View style={styles.statusLine}>
          <Text style={styles.code} numberOfLines={1}>{clubCode(data.club.name)}</Text>
          <Text style={styles.status} numberOfLines={1}>
            {`S${data.seasonNumber} · ${league} · P${data.position > 0 ? data.position : '–'}`}
          </Text>
        </View>
        <Text style={styles.title}>{`Matchday ${data.matchday} / ${data.totalMatchdays}`}</Text>
        {data.opponent ? (
          <View style={styles.fixture}>
            <HomeBadge club={data.club} size={28} radius={6} font={badgeFont} />
            <Text style={styles.fixtureName}>{data.club.shortName}</Text>
            <Text style={styles.vs}>vs</Text>
            <Text style={styles.fixtureName}>{data.opponent.shortName}</Text>
            <HomeBadge club={data.opponent} size={28} radius={6} font={badgeFont} />
            <Text style={styles.venue}>{`${data.isHome ? 'H' : 'A'} · MD${data.matchday}`}</Text>
          </View>
        ) : (
          <Text style={styles.seasonDone}>SEASON_COMPLETE</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.kpiStrip}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>PTS</Text>
            <Text style={styles.kpiValue}>{data.points}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>GD</Text>
            <Text style={[styles.kpiValue, data.gd >= 0 ? styles.kpiUp : styles.kpiDown]}>{gdText(data.gd)}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>FORM</Text>
            <View style={styles.kpiForm}>
              <FormRow form={data.form} mono />
            </View>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>BUDGET</Text>
            <Text style={styles.kpiTeal}>{formatMoney(data.budget)}</Text>
          </View>
        </View>

        {data.standingsWindow.length > 0 && (
          <View style={styles.standCard}>
            <View style={styles.standHead}>
              <Text style={styles.standHeadLabel}>STANDINGS</Text>
              <Pressable onPress={nav.onTable} accessibilityRole="button">
                <Text style={styles.standFull}>FULL ▸</Text>
              </Pressable>
            </View>
            {data.standingsWindow.map((row) => (
              <View key={row.club.id} style={[styles.standRow, row.isUser && styles.standRowUser]}>
                <Text style={[styles.standRank, row.isUser && styles.standTeal]}>{row.rank}</Text>
                <Text style={[styles.standName, row.isUser && styles.standNameUser]} numberOfLines={1}>
                  {row.club.name}
                </Text>
                <Text style={[styles.standPts, row.isUser && styles.standTeal]}>{row.points}</Text>
              </View>
            ))}
          </View>
        )}

        <Button label="Continue" onPress={nav.onContinue} testID="home-continue" />

        <View style={styles.navStrip}>
          <Pressable style={styles.navCell} onPress={nav.onSquad} accessibilityRole="button">
            <Text style={styles.navText}>SQUAD</Text>
          </Pressable>
          <Pressable style={styles.navCell} onPress={nav.onMarket} accessibilityRole="button">
            <Text style={styles.navText}>MARKET</Text>
          </Pressable>
          <Pressable style={styles.navCell} onPress={nav.onSettings} accessibilityRole="button">
            <Text style={styles.navText}>CONFIG</Text>
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
    header: {
      paddingHorizontal: theme.spacing(2),
      paddingBottom: theme.spacing(1.75),
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    code: { color: theme.colors.accent, fontFamily: theme.fonts.numeric, fontSize: 12, letterSpacing: 0.5, flexShrink: 1 },
    status: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11, marginLeft: theme.spacing(1) },
    title: { color: theme.colors.text, fontFamily: theme.fonts.body, fontWeight: '700', fontSize: 24, marginTop: theme.spacing(1.25) },
    fixture: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1.25),
      marginTop: theme.spacing(1.5),
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(1.5),
    },
    fixtureName: { color: theme.colors.text, fontFamily: theme.fonts.body, fontWeight: '600', fontSize: 14 },
    vs: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 12 },
    venue: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 11, marginLeft: 'auto' },
    seasonDone: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 14, marginTop: theme.spacing(1.5) },

    body: { padding: theme.spacing(2), gap: theme.spacing(1.75) },
    kpiStrip: {
      flexDirection: 'row',
      gap: 1,
      backgroundColor: theme.colors.border,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
    },
    kpiCell: { flex: 1, backgroundColor: theme.colors.surface, paddingVertical: theme.spacing(1.25), paddingHorizontal: theme.spacing(1) },
    kpiLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 10, letterSpacing: 0.5 },
    kpiValue: { color: theme.colors.text, fontFamily: theme.fonts.numeric, fontWeight: '700', fontSize: 20, marginTop: 3 },
    kpiUp: { color: theme.colors.win },
    kpiDown: { color: theme.colors.loss },
    kpiTeal: { color: theme.colors.accent, fontFamily: theme.fonts.numeric, fontWeight: '700', fontSize: 15, marginTop: 6 },
    kpiForm: { marginTop: 6 },

    standCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, overflow: 'hidden' },
    standHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(1.5),
    },
    standHeadLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 10, letterSpacing: 1 },
    standFull: { color: theme.colors.accent, fontFamily: theme.fonts.numeric, fontSize: 10 },
    standRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(1.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    standRowUser: { backgroundColor: theme.colors.surfaceAlt, borderLeftWidth: 2, borderLeftColor: theme.colors.accent },
    standRank: { width: 20, color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 12 },
    standName: { flex: 1, color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 13 },
    standNameUser: { fontWeight: '600' },
    standPts: { color: theme.colors.text, fontFamily: theme.fonts.numeric, fontSize: 13, fontWeight: '700' },
    standTeal: { color: theme.colors.accent },

    navStrip: {
      flexDirection: 'row',
      gap: 1,
      backgroundColor: theme.colors.border,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
    },
    navCell: { flex: 1, backgroundColor: theme.colors.surface, paddingVertical: theme.spacing(1.25), alignItems: 'center' },
    navText: { color: theme.colors.textMuted, fontFamily: theme.fonts.numeric, fontSize: 12 },
  });
