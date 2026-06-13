import { OVERALL_WEIGHTS } from './config';
import type { AttrKey, Player } from './types';
import { clamp } from './util';

export type Area = 'attacking' | 'defending' | 'midfield';

/**
 * THE STAT SEAM. Read a coarse area rating for a player.
 *
 * v1 stores the coarse trio directly. If a future world generates only
 * fine-grained stats (pace/shooting/passing/...), the coarse value is derived
 * here — so every consumer in the engine keeps calling areaRating() and nothing
 * else changes. Adding stat keys is therefore additive, never a save migration.
 */
export function areaRating(player: Player, area: Area): number {
  const direct = player.attrs[area];
  if (direct != null) return direct;
  switch (area) {
    case 'attacking':
      return avgAttrs(player, ['shooting', 'dribbling', 'pace']);
    case 'midfield':
      return avgAttrs(player, ['passing', 'dribbling']);
    case 'defending':
      return avgAttrs(player, ['tackling', 'physical', 'goalkeeping']);
  }
}

function avgAttrs(player: Player, keys: AttrKey[]): number {
  const vals = keys.map((k) => player.attrs[k]).filter((v): v is number => v != null);
  if (!vals.length) return 50;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Single 1..99 overall, weighted by position. */
export function overall(player: Player): number {
  const w = OVERALL_WEIGHTS[player.position];
  const o =
    areaRating(player, 'attacking') * w.attacking +
    areaRating(player, 'defending') * w.defending +
    areaRating(player, 'midfield') * w.midfield;
  return Math.round(clamp(o, 1, 99));
}

/** Effective area rating including current form (used by the match sim). */
export function effectiveArea(player: Player, area: Area): number {
  return clamp(areaRating(player, area) + player.form, 1, 99);
}
