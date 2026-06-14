/**
 * Theming. A `Theme` bundles a colour `Palette` with the shared spacing / radius
 * / font tokens. The "standard" theme follows the OS light/dark setting; a few
 * extra themes can be picked explicitly. Screens never import a static palette —
 * they read the active theme via `useTheme()` / `useThemedStyles()` so a change
 * re-skins the whole app live.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { usePrefsStore } from '../store/prefsStore';

/** Theme-independent design tokens. Only colours change between themes. */
const tokens = {
  spacing: (n: number) => n * 8,
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  font: { title: 30, heading: 22, body: 16, small: 13 },
} as const;

export interface Palette {
  primary: string;
  primaryDark: string;
  accent: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  win: string;
  draw: string;
  loss: string;
  onPrimary: string;
  /** Pitch turf colour (kept in the green family for every theme). */
  field: string;
}

// Shared brand colours referenced by several palettes (named so the same hex
// isn't duplicated across themes).
const WHITE = '#ffffff';
const PITCH_GREEN = '#0b6e4f';
const SIGNAL_RED = '#e5484d';

// ----------------------------------------------------------------- palettes
const dark: Palette = {
  primary: PITCH_GREEN,
  primaryDark: '#08543c',
  accent: '#f4c430',
  bg: '#0f1413',
  surface: '#1b2422',
  surfaceAlt: '#243230',
  text: '#f5f7f6',
  textMuted: '#9fb0aa',
  border: '#2e3d39',
  danger: SIGNAL_RED,
  win: '#3fb950',
  draw: '#d6a728',
  loss: SIGNAL_RED,
  onPrimary: WHITE,
  field: PITCH_GREEN,
};

const light: Palette = {
  primary: PITCH_GREEN,
  primaryDark: '#0a5f45',
  accent: '#9a6700',
  bg: '#eef2f0',
  surface: WHITE,
  surfaceAlt: '#e2e9e5',
  text: '#13201c',
  textMuted: '#5a6b65',
  border: '#d3ddd8',
  danger: '#c0392b',
  win: '#1f8f3c',
  draw: '#9a6700',
  loss: '#c0392b',
  onPrimary: WHITE,
  field: PITCH_GREEN,
};

const midnight: Palette = {
  primary: '#3b5bdb',
  primaryDark: '#243a8f',
  accent: '#ffd43b',
  bg: '#0b1020',
  surface: '#161d33',
  surfaceAlt: '#212a47',
  text: '#eef1fb',
  textMuted: '#9aa6c8',
  border: '#2b3559',
  danger: '#ff6b6b',
  win: '#51cf66',
  draw: '#fcc419',
  loss: '#ff6b6b',
  onPrimary: WHITE,
  field: '#16633f',
};

const claret: Palette = {
  primary: '#7a263a',
  primaryDark: '#5c1b2b',
  accent: '#7cc1f0',
  bg: '#1a1014',
  surface: '#281a1f',
  surfaceAlt: '#37242b',
  text: '#f7eef1',
  textMuted: '#c4a8b0',
  border: '#452e36',
  danger: SIGNAL_RED,
  win: '#5bbf6a',
  draw: '#e0b341',
  loss: SIGNAL_RED,
  onPrimary: WHITE,
  field: '#1f6e44',
};

const sunset: Palette = {
  primary: '#e8590c',
  primaryDark: '#b8430a',
  accent: '#ffd43b',
  bg: '#1d1410',
  surface: '#2c1f17',
  surfaceAlt: '#3c2a1f',
  text: '#fbf0e8',
  textMuted: '#ccb4a3',
  border: '#48342a',
  danger: '#ef5350',
  win: '#66bb6a',
  draw: '#ffb300',
  loss: '#ef5350',
  onPrimary: WHITE,
  field: '#2f7d4f',
};

const graphite: Palette = {
  primary: '#475569',
  primaryDark: '#334155',
  accent: '#2dd4bf',
  bg: '#0f1115',
  surface: '#1a1d23',
  surfaceAlt: '#262a32',
  text: '#f1f3f5',
  textMuted: '#9aa3af',
  border: '#2c313a',
  danger: '#ef4444',
  win: '#22c55e',
  draw: '#eab308',
  loss: '#ef4444',
  onPrimary: WHITE,
  field: '#2a5e46',
};

const RAW = {
  light: { isDark: false, colors: light },
  dark: { isDark: true, colors: dark },
  midnight: { isDark: true, colors: midnight },
  claret: { isDark: true, colors: claret },
  sunset: { isDark: true, colors: sunset },
  graphite: { isDark: true, colors: graphite },
} as const;

export type ThemeName = keyof typeof RAW;

export interface Theme {
  name: ThemeName;
  /** True for dark themes — drives the status bar style and a few adaptive bits. */
  dark: boolean;
  colors: Palette;
  spacing: (n: number) => number;
  radius: typeof tokens.radius;
  font: typeof tokens.font;
}

export const themes = Object.fromEntries(
  (Object.keys(RAW) as ThemeName[]).map((name) => [
    name,
    { name, dark: RAW[name].isDark, colors: RAW[name].colors, ...tokens } satisfies Theme,
  ]),
) as Record<ThemeName, Theme>;

/** What the user has chosen: follow the system, or a specific theme. */
export type ThemePref = 'system' | ThemeName;

/** Selectable options for the Settings picker. */
export const THEME_OPTIONS: { key: ThemePref; label: string; subtitle: string }[] = [
  { key: 'system', label: 'System', subtitle: 'Match device appearance' },
  { key: 'light', label: 'Light', subtitle: 'Pitch green · light' },
  { key: 'dark', label: 'Dark', subtitle: 'Pitch green · dark' },
  { key: 'midnight', label: 'Midnight', subtitle: 'Cool indigo blue' },
  { key: 'claret', label: 'Claret', subtitle: 'Claret & sky blue' },
  { key: 'sunset', label: 'Sunset', subtitle: 'Warm amber & orange' },
  { key: 'graphite', label: 'Graphite', subtitle: 'Neutral slate & teal' },
];

type Scheme = 'light' | 'dark' | null | undefined;

/** Resolve a preference (+ current OS scheme) to a concrete theme. */
export function resolveTheme(pref: ThemePref, scheme: Scheme): Theme {
  const standard = scheme === 'light' ? themes.light : themes.dark;
  // `pref in themes` also guards against a stale/unknown persisted preference.
  if (pref !== 'system' && pref in themes) return themes[pref];
  return standard;
}

// -------------------------------------------------------------- context/hooks
const ThemeContext = createContext<Theme>(themes.dark);

export const useTheme = (): Theme => useContext(ThemeContext);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pref = usePrefsStore((s) => s.themePref);
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(pref, scheme), [pref, scheme]);

  useEffect(() => {
    // Keep the native root background in step with the theme (overscroll, gaps).
    // expo-system-ui is unavailable on some platforms (e.g. web); wrapping in a
    // promise chain swallows both synchronous and async failures.
    void Promise.resolve()
      .then(() => SystemUI.setBackgroundColorAsync(theme.colors.bg))
      .catch(() => undefined);
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// Styles are rebuilt per theme. Cache by (factory, theme) so every component
// sharing a factory reuses one StyleSheet instead of recreating it.
type StyleFactory<T> = (theme: Theme) => T;
const styleCache = new WeakMap<StyleFactory<unknown>, Map<ThemeName, unknown>>();

export function useThemedStyles<T extends object>(factory: StyleFactory<T>): T {
  const theme = useTheme();
  return useMemo(() => {
    let byTheme = styleCache.get(factory as StyleFactory<unknown>);
    if (!byTheme) {
      byTheme = new Map();
      styleCache.set(factory as StyleFactory<unknown>, byTheme);
    }
    let styles = byTheme.get(theme.name) as T | undefined;
    if (!styles) {
      styles = factory(theme);
      byTheme.set(theme.name, styles);
    }
    return styles;
  }, [factory, theme]);
}
