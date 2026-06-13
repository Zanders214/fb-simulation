import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * The persistence seam. Everything the app saves goes through this adapter, so
 * swapping AsyncStorage for a faster backend (e.g. react-native-mmkv, once we
 * move to a dev build) is a one-file change — no game logic touched.
 */
export const storage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};
