/**
 * Theming on two independent axes.
 *
 * - **style** (`broadcast` · `programme` · `terminal`) sets the *typography* and a
 *   handful of structural treatments (header shape, table density, CTA shape, …).
 * - **mode** (`light` · `dark`, or `system`) sets the colour *palette*.
 *
 * A concrete `Theme` is the pair `(style, mode)` — six in total. Screens never
 * import a static palette: they read the active theme via `useTheme()` /
 * `useThemedStyles()`, so changing either axis re-skins the whole app live.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { usePrefsStore } from '../store/prefsStore';

/** Axis-independent design tokens. Only colours + fonts change between themes. */
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

// --------------------------------------------------------------- A · Broadcast
// Pitch-green & gold. The app's heritage look — reused unchanged for both modes.
const broadcastDark: Palette = {
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

const broadcastLight: Palette = {
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

// --------------------------------------------------------------- B · Programme
// Editorial, warm paper. Both modes are new.
const programmeLight: Palette = {
  primary: '#0a5f45',
  primaryDark: '#08543c',
  accent: '#9a6700',
  bg: '#f4f1ea',
  surface: WHITE,
  surfaceAlt: '#eae4d8',
  text: '#1c1a14',
  textMuted: '#6b6457',
  border: '#ddd5c6',
  danger: '#c0392b',
  win: '#1f8f3c',
  draw: '#9a6700',
  loss: '#c0392b',
  onPrimary: WHITE,
  field: PITCH_GREEN,
};

const programmeDark: Palette = {
  primary: '#0a5f45',
  primaryDark: '#073f2d',
  accent: '#c9a227',
  bg: '#16140f',
  surface: '#211e17',
  surfaceAlt: '#2c2820',
  text: '#f3efe6',
  textMuted: '#a89f8d',
  border: '#363128',
  danger: SIGNAL_RED,
  win: '#3fb950',
  draw: '#d6a728',
  loss: SIGNAL_RED,
  onPrimary: WHITE,
  field: PITCH_GREEN,
};

// ---------------------------------------------------------------- C · Terminal
// Slate & teal. Dark is the heritage `graphite` look; light is new.
const terminalLight: Palette = {
  primary: '#475569',
  primaryDark: '#334155',
  accent: '#0d9488',
  bg: '#f3f5f7',
  surface: WHITE,
  surfaceAlt: '#e9edf1',
  text: '#14181f',
  textMuted: '#5b6573',
  border: '#d6dce3',
  danger: '#dc2626',
  win: '#16a34a',
  draw: '#ca8a04',
  loss: '#dc2626',
  onPrimary: WHITE,
  field: '#2a5e46',
};

const terminalDark: Palette = {
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

// ----------------------------------------------------------------------- axes
export type StyleName = 'broadcast' | 'programme' | 'terminal';
export type Mode = 'light' | 'dark';
/** Concrete theme identity — also the `useThemedStyles` cache key. */
export type ThemeName = `${StyleName}:${Mode}`;
/** What the user picks for the colour axis. */
export type ModePref = 'system' | 'light' | 'dark';

const PALETTES: Record<StyleName, Record<Mode, Palette>> = {
  broadcast: { light: broadcastLight, dark: broadcastDark },
  programme: { light: programmeLight, dark: programmeDark },
  terminal: { light: terminalLight, dark: terminalDark },
};

/** Per-style typography. Family strings must match the loaded `expo-font` names. */
export interface Fonts {
  /** Display / titles / scores. */
  heading: string;
  /** UI text. */
  body: string;
  /** Table figures, scorelines, OVR. */
  numeric: string;
  /** Fallback weight before fonts load / on platforms missing the family. */
  headingWeight: '600' | '700' | '800';
  /** Broadcast & Terminal headings shout; Programme stays sentence-case. */
  uppercaseHeadings: boolean;
}

const FONTS: Record<StyleName, Fonts> = {
  broadcast: {
    heading: 'BarlowCondensed_800ExtraBold',
    body: 'Barlow_400Regular',
    numeric: 'Barlow_600SemiBold',
    headingWeight: '800',
    uppercaseHeadings: true,
  },
  programme: {
    heading: 'Newsreader_600SemiBold',
    body: 'HankenGrotesk_400Regular',
    numeric: 'Newsreader_500Medium',
    headingWeight: '600',
    uppercaseHeadings: false,
  },
  terminal: {
    heading: 'IBMPlexMono_600SemiBold',
    body: 'IBMPlexSans_400Regular',
    numeric: 'IBMPlexMono_500Medium',
    headingWeight: '700',
    uppercaseHeadings: false,
  },
};

export interface Theme {
  name: ThemeName;
  style: StyleName;
  mode: Mode;
  /** True for dark themes — drives the status bar style and a few adaptive bits. */
  dark: boolean;
  colors: Palette;
  fonts: Fonts;
  spacing: (n: number) => number;
  radius: typeof tokens.radius;
  /** Numeric size scale (distinct from `fonts`, which carries families/weights). */
  font: typeof tokens.font;
}

const STYLE_NAMES: StyleName[] = ['broadcast', 'programme', 'terminal'];
const MODE_NAMES: Mode[] = ['light', 'dark'];

function buildTheme(style: StyleName, mode: Mode): Theme {
  return {
    name: `${style}:${mode}`,
    style,
    mode,
    dark: mode === 'dark',
    colors: PALETTES[style][mode],
    fonts: FONTS[style],
    ...tokens,
  };
}

export const themes = Object.fromEntries(
  STYLE_NAMES.flatMap((style) =>
    MODE_NAMES.map((mode): [ThemeName, Theme] => [`${style}:${mode}`, buildTheme(style, mode)]),
  ),
) as Record<ThemeName, Theme>;

/** Selectable options for the Settings style picker. */
export const STYLE_OPTIONS: { key: StyleName; label: string; subtitle: string }[] = [
  { key: 'broadcast', label: 'Broadcast', subtitle: 'Condensed type · bold gradients' },
  { key: 'programme', label: 'Programme', subtitle: 'Editorial serif · warm paper' },
  { key: 'terminal', label: 'Terminal', subtitle: 'Monospace · dense data' },
];

/** Selectable options for the Settings appearance picker. */
export const MODE_OPTIONS: { key: ModePref; label: string; subtitle: string }[] = [
  { key: 'system', label: 'System', subtitle: 'Match device appearance' },
  { key: 'light', label: 'Light', subtitle: 'Always light' },
  { key: 'dark', label: 'Dark', subtitle: 'Always dark' },
];

type Scheme = 'light' | 'dark' | null | undefined;

/** System (or an unknown scheme) follows the OS; otherwise the explicit pick wins. */
function resolveMode(modePref: ModePref, scheme: Scheme): Mode {
  if (modePref === 'light') return 'light';
  if (modePref === 'dark') return 'dark';
  return scheme === 'light' ? 'light' : 'dark';
}

/** Resolve the two prefs (+ current OS scheme) to a concrete theme. */
export function resolveTheme(stylePref: StyleName, modePref: ModePref, scheme: Scheme): Theme {
  // Guard against a stale/unknown persisted style preference.
  const style: StyleName = STYLE_NAMES.includes(stylePref) ? stylePref : 'broadcast';
  const mode = resolveMode(modePref, scheme);
  return themes[`${style}:${mode}`];
}

// -------------------------------------------------------------- context/hooks
const ThemeContext = createContext<Theme>(themes['broadcast:dark']);

export const useTheme = (): Theme => useContext(ThemeContext);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const stylePref = usePrefsStore((s) => s.stylePref);
  const modePref = usePrefsStore((s) => s.modePref);
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(stylePref, modePref, scheme), [stylePref, modePref, scheme]);

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
    let byTheme = styleCache.get(factory);
    if (!byTheme) {
      byTheme = new Map();
      styleCache.set(factory, byTheme);
    }
    let styles = byTheme.get(theme.name) as T | undefined;
    if (!styles) {
      styles = factory(theme);
      byTheme.set(theme.name, styles);
    }
    return styles;
  }, [factory, theme]);
}
