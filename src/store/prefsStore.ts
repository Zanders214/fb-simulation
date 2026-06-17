import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storage } from '../persistence/storage';
import type { ModePref, StyleName } from '../theme';

/**
 * User preferences that live independently of any save game (so they survive
 * deleting a career). Persisted under its own storage key.
 *
 * Theming has two independent axes: `stylePref` (typography + treatments) and
 * `modePref` (colour palette, where 'system' follows the OS).
 */
interface PrefsStore {
  stylePref: StyleName;
  modePref: ModePref;
  setStylePref: (pref: StyleName) => void;
  setModePref: (pref: ModePref) => void;
}

/** Only the prefs themselves are persisted; setters come from the initializer. */
type PersistedPrefs = Pick<PrefsStore, 'stylePref' | 'modePref'>;

const DEFAULT_PREFS: PersistedPrefs = { stylePref: 'broadcast', modePref: 'system' };

// Map a pre-v2 single `themePref` onto the two axes. Removed palettes
// (midnight/claret/sunset) collapse onto the heritage Broadcast dark look.
const LEGACY_THEME_MAP: Record<string, PersistedPrefs> = {
  system: { stylePref: 'broadcast', modePref: 'system' },
  light: { stylePref: 'broadcast', modePref: 'light' },
  dark: { stylePref: 'broadcast', modePref: 'dark' },
  graphite: { stylePref: 'terminal', modePref: 'dark' },
  midnight: { stylePref: 'broadcast', modePref: 'dark' },
  claret: { stylePref: 'broadcast', modePref: 'dark' },
  sunset: { stylePref: 'broadcast', modePref: 'dark' },
};

/**
 * v1 stored a single `themePref`; v2 splits it into independent style + mode.
 * Exported for unit testing. Returns state only — zustand re-supplies the
 * setters from the initializer when it merges the migrated state.
 */
export function migratePrefs(persisted: unknown, _version: number): PersistedPrefs {
  const old = (persisted ?? {}) as { themePref?: string };
  if (old.themePref != null && old.themePref in LEGACY_THEME_MAP) {
    return LEGACY_THEME_MAP[old.themePref];
  }
  return DEFAULT_PREFS;
}

export const usePrefsStore = create<PrefsStore>()(
  persist<PrefsStore, [], [], PersistedPrefs>(
    (set) => ({
      ...DEFAULT_PREFS,
      setStylePref: (stylePref) => set({ stylePref }),
      setModePref: (modePref) => set({ modePref }),
    }),
    {
      name: 'fbsim-prefs',
      version: 2,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({ stylePref: s.stylePref, modePref: s.modePref }),
      migrate: migratePrefs,
    },
  ),
);

export const useStylePref = () => usePrefsStore((s) => s.stylePref);
export const useModePref = () => usePrefsStore((s) => s.modePref);
