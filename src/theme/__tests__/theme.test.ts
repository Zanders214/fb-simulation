import { resolveTheme, THEME_OPTIONS, themes, type Palette, type ThemeName, type ThemePref } from '..';

const PALETTE_KEYS: (keyof Palette)[] = [
  'primary',
  'primaryDark',
  'accent',
  'bg',
  'surface',
  'surfaceAlt',
  'text',
  'textMuted',
  'border',
  'danger',
  'win',
  'draw',
  'loss',
  'onPrimary',
  'field',
];

describe('themes', () => {
  it('every theme defines the full palette as hex colours', () => {
    for (const name of Object.keys(themes) as ThemeName[]) {
      const { colors } = themes[name];
      for (const key of PALETTE_KEYS) {
        expect(colors[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('resolves "system" to dark or light based on the OS scheme', () => {
    expect(resolveTheme('system', 'dark')).toBe(themes.dark);
    expect(resolveTheme('system', 'light')).toBe(themes.light);
    // unknown scheme falls back to dark (the app's heritage look)
    expect(resolveTheme('system', null)).toBe(themes.dark);
  });

  it('resolves an explicit preference to that exact theme', () => {
    expect(resolveTheme('midnight', 'light')).toBe(themes.midnight);
    expect(resolveTheme('claret', null)).toBe(themes.claret);
  });

  it('falls back to the standard theme for a stale/unknown preference', () => {
    // e.g. a preference persisted before a theme was renamed or removed
    expect(resolveTheme('neon' as ThemePref, 'dark')).toBe(themes.dark);
    expect(resolveTheme('neon' as ThemePref, 'light')).toBe(themes.light);
  });

  it('exposes a selectable option for "system" and every theme', () => {
    const keys = THEME_OPTIONS.map((o) => o.key);
    expect(keys).toContain('system');
    for (const name of Object.keys(themes) as ThemeName[]) {
      expect(keys).toContain(name);
    }
  });
});
