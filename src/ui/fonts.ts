/**
 * Condensed display font (Barlow Condensed) family names.
 *
 * Plain strings only — safe to import from screens. The actual `.ttf` assets are
 * loaded once in `app/_layout.tsx` via `useFonts`; these keys match the family
 * names that loader registers.
 */
export const condensed = {
  semibold: 'BarlowCondensed_600SemiBold',
  bold: 'BarlowCondensed_700Bold',
  extra: 'BarlowCondensed_800ExtraBold',
} as const;
