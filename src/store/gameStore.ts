import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { dateToTargetMatchday } from '../engine/calendar';
import { SAVE_VERSION } from '../engine/config';
import { generateWorld } from '../engine/content';
import {
  advanceSeason,
  createGame,
  isSeasonComplete,
  type MatchdayOutcome,
  type NewGameOptions,
  playMatchday,
} from '../engine/season';
import { buyPlayer, sellPlayer, type TransferResult } from '../engine/transfers';
import type { Formation, GameState, SquadRoles } from '../engine/types';
import { setFormation, setRole, swapPlayer, swapStarters, toggleTraining } from '../engine/world';
import { storage } from '../persistence/storage';

interface GameStore {
  game: GameState | null;
  /** The most recent matchday outcome, for the result screen. Not persisted. */
  lastOutcome: MatchdayOutcome | null;
  /** True once the persisted save has been read (or confirmed absent) on launch. */
  hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  newGame: (opts: NewGameOptions, seed: number) => void;
  playNextMatchday: () => MatchdayOutcome | null;
  /** Simulate forward through `target` (clamped to the current season). Returns matchdays played. */
  simulateToMatchday: (target: number) => number;
  /** Simulate to the last matchday on or before `date`. Returns matchdays played (0 = no-op). */
  simulateToDate: (date: Date) => number;
  advanceToNextSeason: () => void;
  changeFormation: (formation: Formation) => void;
  assignRole: (role: keyof SquadRoles, playerId: string | undefined) => void;
  toggleTraining: (playerId: string) => void;
  substitute: (outId: string, inId: string) => void;
  swapPositions: (aId: string, bId: string) => void;
  buy: (playerId: string) => TransferResult;
  sell: (playerId: string) => TransferResult;
  resetGame: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Minimal structural check that a persisted value is a usable GameState. It is
 * intentionally shallow — just enough that the screens which deep-dereference
 * the save (match, season, lineup, selectors) can't crash on a stale-shaped or
 * corrupt payload. Anything that fails falls back to "no save" (the main menu).
 */
function isValidSavedGame(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  const world = value.world;
  const squad = value.squad;
  const season = value.season;
  return (
    typeof value.managedClubId === 'string' &&
    isRecord(world) &&
    // `countries` arrived with the division-pyramid world; its absence marks a
    // pre-pyramid save, which we drop rather than crash the season screens on.
    isRecord(world.countries) &&
    isRecord(world.clubs) &&
    isRecord(world.players) &&
    isRecord(squad) &&
    Array.isArray(squad.startingXI) &&
    isRecord(season) &&
    // `otherFixtures` arrived with the fully-simulated world (every league played
    // match-by-match); its absence marks a pre-simulation save, which we drop
    // rather than crash `playMatchday` on a missing schedule map.
    isRecord(season.otherFixtures)
  );
}

/**
 * The single source of truth for the active game. The engine evolves the
 * GameState (mutating its nested world); each action then publishes a new
 * top-level `game` reference so React re-renders, and the persist middleware
 * autosaves the result to storage.
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      lastOutcome: null,
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      newGame: (opts, seed) => {
        const world = generateWorld(seed);
        const game = createGame(world, opts);
        set({ game, lastOutcome: null });
      },

      playNextMatchday: () => {
        const game = get().game;
        if (!game) return null;
        const outcome = playMatchday(game);
        set({ game: { ...game }, lastOutcome: outcome });
        return outcome;
      },

      simulateToMatchday: (target) => {
        const game = get().game;
        if (!game) return 0;
        let played = 0;
        // Reuse the engine; stop at the season boundary so a jump never rolls the
        // season over silently (the Fixtures advance-season flow owns that).
        while (game.season.currentMatchday <= target && !isSeasonComplete(game)) {
          playMatchday(game);
          played += 1;
        }
        if (played > 0) set({ game: { ...game }, lastOutcome: null });
        return played;
      },

      simulateToDate: (date) => {
        const game = get().game;
        if (!game) return 0;
        const target = dateToTargetMatchday(game, date);
        if (target == null) return 0;
        return get().simulateToMatchday(target);
      },

      advanceToNextSeason: () => {
        const game = get().game;
        if (!game) return;
        advanceSeason(game);
        set({ game: { ...game }, lastOutcome: null });
      },

      changeFormation: (formation) => {
        const game = get().game;
        if (!game) return;
        game.squad = setFormation(game.squad, formation);
        set({ game: { ...game } });
      },

      assignRole: (role, playerId) => {
        const game = get().game;
        if (!game) return;
        game.squad = setRole(game.squad, role, playerId);
        set({ game: { ...game } });
      },

      toggleTraining: (playerId) => {
        const game = get().game;
        if (!game) return;
        // self-heal: drop any training ids the club no longer owns (e.g. a sold
        // player) before toggling, so a stale slot can never block a new pick.
        const owned = new Set(game.world.clubs[game.managedClubId].playerIds);
        const pruned = (game.squad.trainingIds ?? []).filter((id) => owned.has(id));
        game.squad = toggleTraining({ ...game.squad, trainingIds: pruned }, playerId);
        set({ game: { ...game } });
      },

      substitute: (outId, inId) => {
        const game = get().game;
        if (!game) return;
        game.squad = swapPlayer(game.squad, outId, inId);
        set({ game: { ...game } });
      },

      swapPositions: (aId, bId) => {
        const game = get().game;
        if (!game) return;
        game.squad = swapStarters(game.squad, aId, bId);
        set({ game: { ...game } });
      },

      buy: (playerId) => {
        const game = get().game;
        if (!game) return { ok: false, reason: 'No active game.' };
        const result = buyPlayer(game, playerId);
        if (result.ok) set({ game: { ...game } });
        return result;
      },

      sell: (playerId) => {
        const game = get().game;
        if (!game) return { ok: false, reason: 'No active game.' };
        const result = sellPlayer(game, playerId);
        if (result.ok) set({ game: { ...game } });
        return result;
      },

      resetGame: () => set({ game: null, lastOutcome: null }),
    }),
    {
      name: 'fbsim-save',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => storage),
      // only the game is durable; lastOutcome/hasHydrated are session state
      partialize: (s) => ({ game: s.game }),
      // Defensive: a stale-shaped or corrupt payload (e.g. an old save after a
      // SAVE_VERSION bump) becomes "no save", so the app falls back to the main
      // menu instead of crashing a screen that deep-dereferences it. Add
      // forward-transform branches per old version here as the schema evolves.
      migrate: (persisted) => {
        const game = isRecord(persisted) ? persisted.game : undefined;
        return { game: isValidSavedGame(game) ? game : null };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[fbsim] failed to load saved game; starting fresh.', error);
        }
        // Always leave the loading state — even on a parse error, where `state`
        // is undefined — so the app opens on the main menu rather than hanging.
        useGameStore.setState({ hasHydrated: true });
      },
    },
  ),
);

// ---- convenience selectors ----
export const useGame = () => useGameStore((s) => s.game);
export const useHasSave = () => useGameStore((s) => s.game !== null);
export const useHasHydrated = () => useGameStore((s) => s.hasHydrated);
