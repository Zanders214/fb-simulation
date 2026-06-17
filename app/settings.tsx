import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useGameStore } from '../src/store/gameStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { confirmAction } from '../src/ui/confirm';
import {
  MODE_OPTIONS,
  resolveTheme,
  STYLE_OPTIONS,
  themes,
  useThemedStyles,
  type ModePref,
  type Palette,
  type StyleName,
  type Theme,
} from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const scheme = useColorScheme();
  const hasSave = useGameStore((s) => s.game !== null);
  const resetGame = useGameStore((s) => s.resetGame);
  const stylePref = usePrefsStore((s) => s.stylePref);
  const modePref = usePrefsStore((s) => s.modePref);
  const setStylePref = usePrefsStore((s) => s.setStylePref);
  const setModePref = usePrefsStore((s) => s.setModePref);

  // Preview each style swatch in the appearance the user is currently resolving to.
  const resolvedMode = resolveTheme(stylePref, modePref, scheme).mode;

  const onSelectStyle = useCallback((key: string) => setStylePref(key as StyleName), [setStylePref]);
  const onSelectMode = useCallback((key: string) => setModePref(key as ModePref), [setModePref]);

  const confirmReset = useCallback(() => {
    confirmAction({
      title: 'Delete save?',
      message: 'Your current career will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        resetGame();
        router.dismissTo('/');
      },
    });
  }, [resetGame, router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>Style</Text>
        <Text style={styles.muted}>Typography and layout treatment — each restyles the whole app.</Text>
        <View style={styles.optionList}>
          {STYLE_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.key}
              optionKey={opt.key}
              label={opt.label}
              subtitle={opt.subtitle}
              palette={themes[`${opt.key}:${resolvedMode}`].colors}
              selected={stylePref === opt.key}
              onSelect={onSelectStyle}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.mt}>
        <Text style={styles.label}>Appearance</Text>
        <Text style={styles.muted}>
          “System” follows your device’s light/dark setting. Pick one to override it.
        </Text>
        <View style={styles.optionList}>
          {MODE_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.key}
              optionKey={opt.key}
              label={opt.label}
              subtitle={opt.subtitle}
              palette={resolveTheme(stylePref, opt.key, scheme).colors}
              selected={modePref === opt.key}
              onSelect={onSelectMode}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.mt}>
        <Text style={styles.label}>Save</Text>
        <Text style={styles.value}>{hasSave ? 'A career is in progress.' : 'No saved career.'}</Text>
        <Button label="Delete save" variant="danger" onPress={confirmReset} disabled={!hasSave} style={styles.btn} />
      </Card>

      <Card style={styles.mt}>
        <Text style={styles.label}>About</Text>
        <Text style={styles.value}>FB Simulation · pre-alpha</Text>
        <Text style={styles.muted}>Fictional clubs and players. Built with Expo + React Native.</Text>
      </Card>
    </ScrollView>
  );
}

const OptionRow = memo(function OptionRow({
  optionKey,
  label,
  subtitle,
  palette,
  selected,
  onSelect,
}: Readonly<{
  optionKey: string;
  label: string;
  subtitle: string;
  palette: Palette;
  selected: boolean;
  onSelect: (key: string) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const onPress = useCallback(() => onSelect(optionKey), [onSelect, optionKey]);
  const accessibilityState = useMemo(() => ({ selected }), [selected]);
  const rowStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [styles.row, selected && styles.rowActive, pressed && styles.pressed],
    [styles, selected],
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={accessibilityState} style={rowStyle}>
      <View style={[styles.swatch, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <View style={[styles.swatchPrimary, { backgroundColor: palette.primary }]} />
        <View style={[styles.swatchAccent, { backgroundColor: palette.accent }]} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionSub}>{subtitle}</Text>
      </View>
      <Text style={[styles.check, !selected && styles.checkHidden]}>✓</Text>
    </Pressable>
  );
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    mt: { marginTop: theme.spacing(2) },
    label: {
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
      fontSize: theme.font.small,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    value: {
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
      fontSize: theme.font.body,
      marginTop: theme.spacing(0.5),
    },
    muted: {
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
      fontSize: theme.font.small,
      marginTop: theme.spacing(1),
    },
    btn: { marginTop: theme.spacing(2) },

    optionList: { marginTop: theme.spacing(1.5), gap: theme.spacing(1) },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    rowActive: { borderColor: theme.colors.accent },
    pressed: { opacity: 0.7 },
    swatch: {
      width: 46,
      height: 46,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    swatchPrimary: { width: 26, height: 26, borderRadius: 13 },
    swatchAccent: { position: 'absolute', right: 5, bottom: 5, width: 14, height: 14, borderRadius: 7 },
    optionText: { flex: 1, minWidth: 0 },
    optionLabel: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontWeight: theme.fonts.headingWeight, fontSize: theme.font.body },
    optionSub: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: theme.font.small, marginTop: 1 },
    check: { color: theme.colors.accent, fontSize: 20, fontWeight: '900', minWidth: 24, textAlign: 'center' },
    checkHidden: { opacity: 0 },
  });
