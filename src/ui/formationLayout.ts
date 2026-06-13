import type { Formation } from '../engine';

/**
 * Visual placement of a single lineup slot on the pitch.
 * `x`/`y` are fractions of the pitch (0..1): x is left→right, y is the
 * attacking end (0, top) → own goal (1, bottom), matching the portrait
 * orientation users expect (GK at the bottom, forwards at the top).
 * `label` is the on-pitch position tag shown in the slot (e.g. LB, AM, CF).
 */
export interface FormationSlot {
  label: string;
  x: number;
  y: number;
}

/**
 * Pitch coordinates for every formation, one entry per starting slot.
 *
 * CRITICAL: the slot order MUST match the order of `SquadConfig.startingXI`,
 * which the engine always builds as GK → DEF → MID → FWD (see `autoPickSquad`
 * and `swapPlayer`, which preserve index order). So `slots[i]` is the home of
 * `startingXI[i]`, and the per-group counts here mirror `FORMATIONS`.
 */
export const FORMATION_LAYOUTS: Record<Formation, FormationSlot[]> = {
  // 4-4-2 diamond: DM at the base, LM/RM wide, AM at the tip, two strikers.
  '4-4-2': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'LB', x: 0.16, y: 0.72 },
    { label: 'CB', x: 0.38, y: 0.74 },
    { label: 'CB', x: 0.62, y: 0.74 },
    { label: 'RB', x: 0.84, y: 0.72 },
    { label: 'DM', x: 0.5, y: 0.58 },
    { label: 'LM', x: 0.16, y: 0.46 },
    { label: 'RM', x: 0.84, y: 0.46 },
    { label: 'AM', x: 0.5, y: 0.32 },
    { label: 'CF', x: 0.36, y: 0.14 },
    { label: 'CF', x: 0.64, y: 0.14 },
  ],
  '4-3-3': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'LB', x: 0.15, y: 0.72 },
    { label: 'CB', x: 0.38, y: 0.74 },
    { label: 'CB', x: 0.62, y: 0.74 },
    { label: 'RB', x: 0.85, y: 0.72 },
    { label: 'CM', x: 0.27, y: 0.5 },
    { label: 'CM', x: 0.5, y: 0.46 },
    { label: 'CM', x: 0.73, y: 0.5 },
    { label: 'LW', x: 0.18, y: 0.18 },
    { label: 'ST', x: 0.5, y: 0.14 },
    { label: 'RW', x: 0.82, y: 0.18 },
  ],
  '3-5-2': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'CB', x: 0.27, y: 0.74 },
    { label: 'CB', x: 0.5, y: 0.76 },
    { label: 'CB', x: 0.73, y: 0.74 },
    { label: 'LWB', x: 0.1, y: 0.54 },
    { label: 'CM', x: 0.32, y: 0.48 },
    { label: 'CM', x: 0.5, y: 0.42 },
    { label: 'CM', x: 0.68, y: 0.48 },
    { label: 'RWB', x: 0.9, y: 0.54 },
    { label: 'ST', x: 0.36, y: 0.15 },
    { label: 'ST', x: 0.64, y: 0.15 },
  ],
  '4-2-3-1': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'LB', x: 0.15, y: 0.72 },
    { label: 'CB', x: 0.38, y: 0.74 },
    { label: 'CB', x: 0.62, y: 0.74 },
    { label: 'RB', x: 0.85, y: 0.72 },
    { label: 'DM', x: 0.35, y: 0.56 },
    { label: 'DM', x: 0.65, y: 0.56 },
    { label: 'LM', x: 0.18, y: 0.36 },
    { label: 'AM', x: 0.5, y: 0.34 },
    { label: 'RM', x: 0.82, y: 0.36 },
    { label: 'ST', x: 0.5, y: 0.13 },
  ],
  '5-3-2': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'LWB', x: 0.1, y: 0.7 },
    { label: 'CB', x: 0.3, y: 0.76 },
    { label: 'CB', x: 0.5, y: 0.77 },
    { label: 'CB', x: 0.7, y: 0.76 },
    { label: 'RWB', x: 0.9, y: 0.7 },
    { label: 'CM', x: 0.28, y: 0.48 },
    { label: 'CM', x: 0.5, y: 0.44 },
    { label: 'CM', x: 0.72, y: 0.48 },
    { label: 'ST', x: 0.36, y: 0.16 },
    { label: 'ST', x: 0.64, y: 0.16 },
  ],
  '4-5-1': [
    { label: 'GK', x: 0.5, y: 0.9 },
    { label: 'LB', x: 0.15, y: 0.72 },
    { label: 'CB', x: 0.38, y: 0.74 },
    { label: 'CB', x: 0.62, y: 0.74 },
    { label: 'RB', x: 0.85, y: 0.72 },
    { label: 'LM', x: 0.1, y: 0.46 },
    { label: 'CM', x: 0.3, y: 0.48 },
    { label: 'CM', x: 0.5, y: 0.42 },
    { label: 'CM', x: 0.7, y: 0.48 },
    { label: 'RM', x: 0.9, y: 0.46 },
    { label: 'ST', x: 0.5, y: 0.15 },
  ],
};
