import { applyMatchProgression, applyTrainingProgression } from '../progression';
import type { PlayerRating } from '../types';
import { makePlayer } from './factory';

function rating(r: number): PlayerRating {
  return { playerId: 'x', rating: r, goals: 0, assists: 0 };
}

describe('applyMatchProgression training boost', () => {
  // a young player with plenty of headroom so growth is comfortably non-zero
  const base = () => makePlayer({ position: 'FWD', age: 20, attacking: 50, potential: 90 });

  // total development = whole stat points already banked + leftover fractional XP
  const dev = (p: ReturnType<typeof base>) => (p.attrs.attacking ?? 0) - 50 + p.growthXp;

  it('develops faster from a good match when in training', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(8.5), false);
    applyMatchProgression(trained, rating(8.5), true);

    expect(dev(normal)).toBeGreaterThan(0);
    expect(dev(trained)).toBeGreaterThan(dev(normal));
    // ~5x stronger positive growth
    expect(dev(trained)).toBeCloseTo(dev(normal) * 5, 5);
  });

  it('loses less from a bad match when in training', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(4.0), false);
    applyMatchProgression(trained, rating(4.0), true);

    expect(dev(normal)).toBeLessThan(0);
    // training softens the decline, so it stays closer to zero (less negative)
    expect(dev(trained)).toBeGreaterThan(dev(normal));
    expect(dev(trained)).toBeLessThan(0);
  });

  it('leaves form unchanged by the training flag', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(8.5), false);
    applyMatchProgression(trained, rating(8.5), true);
    expect(trained.form).toBeCloseTo(normal.form, 5);
  });

  it('matches the legacy behaviour when the flag is omitted', () => {
    const a = base();
    const b = base();
    applyMatchProgression(a, rating(7.5));
    applyMatchProgression(b, rating(7.5), false);
    expect(a.growthXp).toBe(b.growthXp);
  });

  it('develops a benched training player off the pitch (no form change)', () => {
    const benched = base();
    applyTrainingProgression(benched);
    expect(dev(benched)).toBeGreaterThan(0);
    expect(benched.form).toBe(0); // didn't play, so form is untouched
    expect(benched.seasonApps).toBe(0); // no appearance recorded
  });

  it('does not develop a maxed-out player with no headroom', () => {
    const capped = makePlayer({ position: 'FWD', age: 20, attacking: 90, potential: 50 });
    const before = capped.growthXp;
    applyTrainingProgression(capped);
    expect(capped.growthXp).toBe(before);
  });
});
