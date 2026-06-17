import {
  MODE_OPTIONS,
  resolveTheme,
  STYLE_OPTIONS,
  themes,
  type Mode,
  type Palette,
  type StyleName,
  type ThemeName,
} from '..';

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

const STYLES: StyleName[] = ['broadcast', 'programme', 'terminal'];
const MODES: Mode[] = ['light', 'dark'];

describe('themes', () => {
  it('defines exactly the six style×mode themes', () => {
    expect(Object.keys(themes).sort()).toEqual(
      [
        'broadcast:dark',
        'broadcast:light',
        'programme:dark',
        'programme:light',
        'terminal:dark',
        'terminal:light',
      ].sort(),
    );
  });

  it('every theme defines the full palette as hex colours', () => {
    for (const name of Object.keys(themes) as ThemeName[]) {
      const { colors } = themes[name];
      for (const key of PALETTE_KEYS) {
        expect(colors[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('every theme carries a valid fonts token group', () => {
    for (const name of Object.keys(themes) as ThemeName[]) {
      const { fonts } = themes[name];
      expect(fonts.heading.length).toBeGreaterThan(0);
      expect(fonts.body.length).toBeGreaterThan(0);
      expect(fonts.numeric.length).toBeGreaterThan(0);
      expect(['600', '700', '800']).toContain(fonts.headingWeight);
      expect(typeof fonts.uppercaseHeadings).toBe('boolean');
    }
  });

  it('marks a theme as dark iff its mode is dark', () => {
    for (const name of Object.keys(themes) as ThemeName[]) {
      expect(themes[name].dark).toBe(themes[name].mode === 'dark');
    }
  });

  it('resolves "system" mode from the OS scheme', () => {
    expect(resolveTheme('broadcast', 'system', 'dark')).toBe(themes['broadcast:dark']);
    expect(resolveTheme('broadcast', 'system', 'light')).toBe(themes['broadcast:light']);
    // unknown scheme falls back to dark (the app's heritage look)
    expect(resolveTheme('broadcast', 'system', null)).toBe(themes['broadcast:dark']);
  });

  it('lets an explicit mode override the OS scheme', () => {
    expect(resolveTheme('terminal', 'light', 'dark')).toBe(themes['terminal:light']);
    expect(resolveTheme('programme', 'dark', 'light')).toBe(themes['programme:dark']);
  });

  it('resolves every style × mode combination', () => {
    for (const style of STYLES) {
      for (const mode of MODES) {
        expect(resolveTheme(style, mode, null)).toBe(themes[`${style}:${mode}`]);
      }
    }
  });

  it('falls back to broadcast for a stale/unknown style preference', () => {
    expect(resolveTheme('neon' as StyleName, 'dark', null)).toBe(themes['broadcast:dark']);
    expect(resolveTheme('neon' as StyleName, 'light', null)).toBe(themes['broadcast:light']);
  });

  it('exposes a selectable option for every style and mode', () => {
    expect(STYLE_OPTIONS.map((o) => o.key).sort()).toEqual([...STYLES].sort());
    expect(MODE_OPTIONS.map((o) => o.key).sort()).toEqual(['dark', 'light', 'system']);
  });
});
