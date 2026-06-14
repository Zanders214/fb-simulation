import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storage } from '../persistence/storage';
import type { ThemePref } from '../theme';

/**
 * User preferences that live independently of any save game (so they survive
 * deleting a career). Persisted under its own storage key.
 */
interface PrefsStore {
  /** 'system' follows the OS light/dark setting; anything else is an explicit theme. */
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
}

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set) => ({
      themePref: 'system',
      setThemePref: (themePref) => set({ themePref }),
    }),
    {
      name: 'fbsim-prefs',
      version: 1,
      storage: createJSONStorage(() => storage),
    },
  ),
);

export const useThemePref = () => usePrefsStore((s) => s.themePref);
