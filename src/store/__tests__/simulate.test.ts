jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { matchdayDate } from '../../engine/calendar';
import { generateWorld } from '../../engine/content';
import { createGame, isSeasonComplete, leagueTable, playMatchday } from '../../engine/season';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

function makeGame(seed: number): GameState {
  const w = generateWorld(seed);
  return createGame(w, { leagueId: 'L0', mode: 'takeover', takeoverClubId: w.leagues['L0'].clubIds[0] });
}

function load(seed: number): GameState {
  const game = makeGame(seed);
  useGameStore.setState({ game, lastOutcome: null });
  return game;
}

beforeEach(() => useGameStore.setState({ game: null, lastOutcome: null }));

describe('simulateToMatchday', () => {
  it('produces the same table as playing each matchday sequentially', () => {
    load(99);
    useGameStore.getState().simulateToMatchday(12);
    const jumped = leagueTable(useGameStore.getState().game!);

    const ref = makeGame(99); // identical seed, played one matchday at a time
    while (ref.season.currentMatchday <= 12 && !isSeasonComplete(ref)) playMatchday(ref);

    expect(JSON.stringify(jumped)).toBe(JSON.stringify(leagueTable(ref)));
  });

  it('advances by the number played and records results only in range', () => {
    load(5);
    const played = useGameStore.getState().simulateToMatchday(8);
    expect(played).toBe(8);

    const g = useGameStore.getState().game!;
    expect(g.season.currentMatchday).toBe(9);
    expect(g.season.fixtures.filter((f) => f.matchday <= 8).every((f) => !!f.result)).toBe(true);
    expect(g.season.fixtures.filter((f) => f.matchday > 8).some((f) => !!f.result)).toBe(false);
  });

  it('stops at the season boundary without rolling the season over', () => {
    const start = load(3);
    const played = useGameStore.getState().simulateToMatchday(9999);
    const g = useGameStore.getState().game!;

    expect(played).toBe(g.season.totalMatchdays);
    expect(g.season.number).toBe(start.season.number);
    expect(g.season.currentMatchday).toBe(g.season.totalMatchdays + 1);
    expect(isSeasonComplete(g)).toBe(true);
  });

  it('does nothing when the target is not ahead', () => {
    load(1);
    useGameStore.getState().simulateToMatchday(5); // now at matchday 6
    const snapshot = JSON.stringify(useGameStore.getState().game);

    expect(useGameStore.getState().simulateToMatchday(3)).toBe(0);
    expect(JSON.stringify(useGameStore.getState().game)).toBe(snapshot);
  });
});

describe('simulateToDate', () => {
  it('plays through the matchday on the tapped date', () => {
    const g0 = load(8);
    const target = matchdayDate(g0.season.number, 7, g0.season.totalMatchdays);
    expect(useGameStore.getState().simulateToDate(target)).toBe(7);
    expect(useGameStore.getState().game!.season.currentMatchday).toBe(8);
  });

  it('is a no-op for a date in the past', () => {
    const g0 = load(8);
    useGameStore.getState().simulateToMatchday(5); // at matchday 6
    const past = matchdayDate(g0.season.number, 1, g0.season.totalMatchdays);
    expect(useGameStore.getState().simulateToDate(past)).toBe(0);
  });
});
