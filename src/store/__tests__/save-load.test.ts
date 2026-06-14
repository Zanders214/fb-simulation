jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_VERSION } from '../../engine/config';
import { generateWorld } from '../../engine/content';
import { createGame } from '../../engine/season';
import { useGameStore } from '../gameStore';

const KEY = 'fbsim-save';

/** Seed the persist key in the shape zustand writes: { state, version }. */
function seed(value: unknown): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify(value));
}

describe('save load robustness', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useGameStore.setState({ game: null, hasHydrated: false });
  });

  it('falls back to no save when an old-version, stale-shaped payload is loaded', async () => {
    // An old save after a SAVE_VERSION bump: migrate runs and should reject it.
    await seed({ version: 0, state: { game: { foo: 'bar' } } });
    await expect(useGameStore.persist.rehydrate()).resolves.toBeUndefined();
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().hasHydrated).toBe(true);
  });

  it('marks hydration done when there is no save at all', async () => {
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().hasHydrated).toBe(true);
  });

  it('loads a valid current-version save unchanged', async () => {
    const w = generateWorld(2024);
    const game = createGame(w, {
      leagueId: 'L0',
      mode: 'takeover',
      takeoverClubId: w.leagues['L0'].clubIds[0],
    });
    await seed({ version: SAVE_VERSION, state: { game } });

    await useGameStore.persist.rehydrate();

    const loaded = useGameStore.getState().game;
    expect(loaded).not.toBeNull();
    expect(loaded?.managedClubId).toBe(game.managedClubId);
    expect(loaded?.squad.startingXI).toHaveLength(11);
  });
});
