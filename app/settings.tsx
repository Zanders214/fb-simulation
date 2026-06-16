import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useGameStore } from '../src/store/gameStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { confirmAction } from '../src/ui/confirm';
import {
  resolveTheme,
  THEME_OPTIONS,
  themes,
  useThemedStyles,
  type Palette,
  type Theme,
  type ThemePref,
} from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const scheme = useColorScheme();
  const hasSave = useGameStore((s) => s.game !== null);
  const resetGame = useGameStore((s) => s.resetGame);
  const themePref = usePrefsStore((s) => s.themePref);
  const setThemePref = usePrefsStore((s) => s.setThemePref);

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
        <Text style={styles.label}>Appearance</Text>
        <Text style={styles.muted}>
          “System” follows your device’s light/dark setting. Pick a theme to override it.
        </Text>
        <View style={styles.themeList}>
          {THEME_OPTIONS.map((opt) => {
            const palette = opt.key === 'system' ? resolveTheme('system', scheme).colors : themes[opt.key].colors;
            return (
              <ThemeOption
                key={opt.key}
                optionKey={opt.key}
                label={opt.label}
                subtitle={opt.subtitle}
                palette={palette}
                selected={themePref === opt.key}
                onSelect={setThemePref}
              />
            );
          })}
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

const ThemeOption = memo(function ThemeOption({
  optionKey,
  label,
  subtitle,
  palette,
  selected,
  onSelect,
}: Readonly<{
  optionKey: ThemePref;
  label: string;
  subtitle: string;
  palette: Palette;
  selected: boolean;
  onSelect: (pref: ThemePref) => void;
}>) {
  const styles = useThemedStyles(makeStyles);
  const onPress = useCallback(() => onSelect(optionKey), [onSelect, optionKey]);
  const accessibilityState = useMemo(() => ({ selected }), [selected]);
  const rowStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [styles.themeRow, selected && styles.themeRowActive, pressed && styles.pressed],
    [styles, selected],
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={accessibilityState}
      style={rowStyle}
    >
      <View style={[styles.swatch, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <View style={[styles.swatchPrimary, { backgroundColor: palette.primary }]} />
        <View style={[styles.swatchAccent, { backgroundColor: palette.accent }]} />
      </View>
      <View style={styles.themeText}>
        <Text style={styles.themeLabel}>{label}</Text>
        <Text style={styles.themeSub}>{subtitle}</Text>
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
    label: { color: theme.colors.textMuted, fontSize: theme.font.small, textTransform: 'uppercase', letterSpacing: 1 },
    value: { color: theme.colors.text, fontSize: theme.font.body, marginTop: theme.spacing(0.5) },
    muted: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.spacing(1) },
    btn: { marginTop: theme.spacing(2) },

    themeList: { marginTop: theme.spacing(1.5), gap: theme.spacing(1) },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    themeRowActive: { borderColor: theme.colors.accent },
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
    themeText: { flex: 1, minWidth: 0 },
    themeLabel: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
    themeSub: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 1 },
    check: { color: theme.colors.accent, fontSize: 20, fontWeight: '900', minWidth: 24, textAlign: 'center' },
    checkHidden: { opacity: 0 },
  });
