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

  it('rejects a pre-simulation save whose season has no otherFixtures', async () => {
    const w = generateWorld(2024);
    const game = createGame(w, {
      leagueId: 'L0',
      mode: 'takeover',
      takeoverClubId: w.leagues['L0'].clubIds[0],
    });
    // An older (v2) save: a valid-looking season, but without the all-league
    // schedules the fully-simulated world needs. It must fall back to no save.
    const legacy = { ...game, season: { ...game.season } };
    delete (legacy.season as { otherFixtures?: unknown }).otherFixtures;
    await seed({ version: 2, state: { game: legacy } });

    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().game).toBeNull();
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

  // Host-contract analog (the pluginval "state survives a load" half): the whole
  // game must round-trip through the durable layer with nothing dropped or
  // transformed — not just a spot-checked field or two.
  it('round-trips a full game through the persist layer with deep equality', async () => {
    const w = generateWorld(2024);
    const game = createGame(w, {
      leagueId: 'L0',
      mode: 'takeover',
      takeoverClubId: w.leagues['L0'].clubIds[0],
    });
    await seed({ version: SAVE_VERSION, state: { game } });

    await useGameStore.persist.rehydrate();

    // The persist layer stores JSON, so the loaded game must equal the
    // JSON-canonical form of the original (the same normalisation the storage
    // round-trip applies) — proving partialize/storage drop nothing.
    expect(useGameStore.getState().game).toEqual(JSON.parse(JSON.stringify(game)));
  });

  // Forward-compatibility: a save written before a newer OPTIONAL field existed
  // must still load and stay playable, because the engine reads those fields
  // defensively (?? [] / ?? {}). This locks in that tolerated-drift guarantee —
  // the existing tests only cover REJECTION of incompatible saves.
  it('loads and stays playable when a save omits newer optional fields', async () => {
    const w = generateWorld(2024);
    const game = createGame(w, {
      leagueId: 'L0',
      mode: 'takeover',
      takeoverClubId: w.leagues['L0'].clubIds[0],
    });
    // An older save: strip fields the engine added later and reads with `?? []`
    // (club recent-form history, the squad's training slots).
    const legacy = JSON.parse(JSON.stringify(game));
    for (const id of Object.keys(legacy.world.clubs)) delete legacy.world.clubs[id].recentForm;
    delete legacy.squad.trainingIds;
    await seed({ version: SAVE_VERSION, state: { game: legacy } });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().game).not.toBeNull();
    // Still playable: the engine tolerates the missing optional fields.
    expect(() => useGameStore.getState().playNextMatchday()).not.toThrow();
  });
});
