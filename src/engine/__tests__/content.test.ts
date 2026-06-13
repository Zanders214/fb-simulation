import { overall } from '../attrs';
import { CONTENT } from '../config';
import { generateWorld } from '../content';
import type { Position } from '../types';

describe('content generation', () => {
  it('is reproducible for a seed', () => {
    expect(JSON.stringify(generateWorld(12345))).toEqual(JSON.stringify(generateWorld(12345)));
  });

  it('different seeds give different worlds', () => {
    expect(JSON.stringify(generateWorld(1))).not.toEqual(JSON.stringify(generateWorld(2)));
  });

  it('has the expected league/club/squad structure', () => {
    const w = generateWorld(999);
    expect(Object.keys(w.leagues).length).toBe(CONTENT.LEAGUES);
    for (const lg of Object.values(w.leagues)) {
      expect(lg.clubIds.length).toBe(CONTENT.CLUBS_PER_LEAGUE);
      for (const cid of lg.clubIds) {
        const club = w.clubs[cid];
        expect(club.playerIds.length).toBe(CONTENT.SQUAD_SIZE);
        const byPos: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const pid of club.playerIds) byPos[w.players[pid].position]++;
        expect(byPos).toEqual(CONTENT.POSITION_QUOTA);
      }
    }
  });

  it('keeps stats, potential and ages in sane ranges', () => {
    const w = generateWorld(555);
    for (const p of Object.values(w.players)) {
      for (const k of ['attacking', 'defending', 'midfield'] as const) {
        const v = p.attrs[k] as number;
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
      expect(p.potential).toBeGreaterThanOrEqual(overall(p));
      expect(p.potential).toBeLessThanOrEqual(99);
      expect(p.age).toBeGreaterThanOrEqual(17);
      expect(p.age).toBeLessThanOrEqual(36);
    }
  });

  it('gives club short codes and colours', () => {
    const w = generateWorld(7);
    for (const club of Object.values(w.clubs)) {
      expect(club.shortName.length).toBeGreaterThanOrEqual(2);
      expect(club.shortName.length).toBeLessThanOrEqual(3);
      expect(club.primaryColor).toMatch(/^#/);
    }
  });
});
