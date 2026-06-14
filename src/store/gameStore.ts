import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SAVE_VERSION } from '../engine/config';
import { generateWorld } from '../engine/content';
import {
  advanceSeason,
  createGame,
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
      migrate: (persisted) => persisted as { game: GameState | null },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// ---- convenience selectors ----
export const useGame = () => useGameStore((s) => s.game);
export const useHasSave = () => useGameStore((s) => s.game !== null);
export const useHasHydrated = () => useGameStore((s) => s.hasHydrated);
