/**
 * Central theme. Football-flavoured dark palette (pitch green + gold).
 * Keep all colors/spacing here so screens stay consistent and re-skinning is one file.
 */
export const theme = {
  colors: {
    primary: '#0b6e4f', // pitch green
    primaryDark: '#08543c',
    accent: '#f4c430', // gold (captain/highlights)
    bg: '#0f1413', // app background
    surface: '#1b2422', // cards
    surfaceAlt: '#243230', // alt rows / pressed
    text: '#f5f7f6',
    textMuted: '#9fb0aa',
    border: '#2e3d39',
    danger: '#e5484d',
    win: '#3fb950',
    draw: '#d6a728',
    loss: '#e5484d',
    onPrimary: '#ffffff',
  },
  spacing: (n: number) => n * 8,
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  font: {
    title: 30,
    heading: 22,
    body: 16,
    small: 13,
  },
} as const;

export type Theme = typeof theme;
