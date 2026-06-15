import { FORM, SIM } from '../config';
import { applyCard, applyInjury, applyMatchProgression, applySeasonEnd, applyTrainingProgression } from '../progression';
import { rewardMultiplierFromExpected } from '../ranking';
import type { CardEvent, InjuryEvent, PlayerRating } from '../types';
import { makePlayer } from './factory';

function rating(r: number, goals = 0, assists = 0): PlayerRating {
  return { playerId: 'x', rating: r, goals, assists };
}

describe('applyMatchProgression training boost', () => {
  // a young player with plenty of headroom so growth is comfortably non-zero
  const base = () => makePlayer({ position: 'FWD', age: 20, attacking: 50, potential: 90 });

  // total development = whole stat points already banked + leftover fractional XP
  const dev = (p: ReturnType<typeof base>) => (p.attrs.attacking ?? 0) - 50 + p.growthXp;

  it('develops faster from a good match when in training', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(8.5), {});
    applyMatchProgression(trained, rating(8.5), { inTraining: true });

    expect(dev(normal)).toBeGreaterThan(0);
    expect(dev(trained)).toBeGreaterThan(dev(normal));
    // ~5x stronger positive growth
    expect(dev(trained)).toBeCloseTo(dev(normal) * 5, 5);
  });

  it('loses less from a bad match when in training', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(4.0), {});
    applyMatchProgression(trained, rating(4.0), { inTraining: true });

    expect(dev(normal)).toBeLessThan(0);
    // training softens the decline, so it stays closer to zero (less negative)
    expect(dev(trained)).toBeGreaterThan(dev(normal));
    expect(dev(trained)).toBeLessThan(0);
  });

  it('leaves form unchanged by the training flag', () => {
    const normal = base();
    const trained = base();
    applyMatchProgression(normal, rating(8.5), {});
    applyMatchProgression(trained, rating(8.5), { inTraining: true });
    expect(trained.form).toBeCloseTo(normal.form, 5);
  });

  it('matches the default behaviour when no context is passed', () => {
    const a = base();
    const b = base();
    applyMatchProgression(a, rating(7.5));
    applyMatchProgression(b, rating(7.5), {});
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

  // development banked + leftover XP, measured off a fixed start of 50 (any area works,
  // since development moves all three areas together)
  const devOf = (p: ReturnType<typeof makePlayer>) => (p.attrs.attacking ?? 0) - 50 + p.growthXp;

  it('rewards a goal or assist with ~3x development', () => {
    const plain = base();
    const scorer = base();
    applyMatchProgression(plain, rating(7.5, 0, 0));
    applyMatchProgression(scorer, rating(7.5, 1, 0));
    expect(devOf(plain)).toBeGreaterThan(0);
    expect(devOf(scorer)).toBeCloseTo(devOf(plain) * 3, 5);
  });

  it('rewards a defender for a clean sheet with ~3x development', () => {
    const baseDef = () => makePlayer({ position: 'DEF', age: 20, defending: 50, attacking: 50, potential: 90 });
    const exposed = baseDef();
    const solid = baseDef();
    applyMatchProgression(exposed, rating(7.0), { cleanSheet: false });
    applyMatchProgression(solid, rating(7.0), { cleanSheet: true });
    expect(devOf(exposed)).toBeGreaterThan(0);
    expect(devOf(solid)).toBeCloseTo(devOf(exposed) * 3, 5);
  });

  it('stacks a clean sheet and a goal to ~6x for a defender', () => {
    const baseDef = () => makePlayer({ position: 'DEF', age: 20, defending: 50, attacking: 50, potential: 90 });
    const plain = baseDef();
    const hero = baseDef();
    applyMatchProgression(plain, rating(7.0, 0, 0), {});
    applyMatchProgression(hero, rating(7.0, 1, 0), { cleanSheet: true });
    expect(devOf(hero)).toBeCloseTo(devOf(plain) * 6, 5);
  });

  it('accumulates career apps across matches', () => {
    const p = base();
    applyMatchProgression(p, rating(7.0));
    applyMatchProgression(p, rating(6.0));
    expect(p.seasonApps).toBe(2);
    expect(p.careerApps).toBe(2);
  });

  it('counts a substitute appearance separately from a start (and defaults to a start)', () => {
    const p = base();
    applyMatchProgression(p, rating(7.0)); // default: a start
    applyMatchProgression(p, rating(6.0), { appearance: 'start' });
    applyMatchProgression(p, rating(6.5), { appearance: 'sub' });
    expect(p.seasonApps).toBe(2);
    expect(p.careerApps).toBe(2);
    expect(p.seasonSubApps).toBe(1);
    expect(p.careerSubApps).toBe(1);
  });

  it('gives a forward no clean-sheet bonus', () => {
    const a = base();
    const b = base();
    applyMatchProgression(a, rating(7.5), { cleanSheet: false });
    applyMatchProgression(b, rating(7.5), { cleanSheet: true });
    expect(dev(b)).toBeCloseTo(dev(a), 5);
  });

  it('softens the loss of ability when a scorer has a poor game', () => {
    const plain = base();
    const scorer = base();
    applyMatchProgression(plain, rating(4.0, 0, 0));
    applyMatchProgression(scorer, rating(4.0, 1, 0));
    expect(dev(plain)).toBeLessThan(0);
    expect(dev(scorer)).toBeGreaterThan(dev(plain)); // hurt less for contributing
    expect(dev(scorer)).toBeLessThan(0); // still a setback
  });

  it('resets season cards on season end but keeps career totals', () => {
    const p = makePlayer({ position: 'MID' });
    p.seasonYellowCards = 4;
    p.seasonRedCards = 1;
    p.careerYellowCards = 9;
    p.careerRedCards = 2;
    applySeasonEnd(p);
    expect(p.seasonYellowCards).toBe(0);
    expect(p.seasonRedCards).toBe(0);
    expect(p.careerYellowCards).toBe(9);
    expect(p.careerRedCards).toBe(2);
  });

  it('resets season sub appearances on season end but keeps the career count', () => {
    const p = makePlayer({ position: 'MID' });
    p.seasonSubApps = 5;
    p.careerSubApps = 12;
    applySeasonEnd(p);
    expect(p.seasonSubApps).toBe(0);
    expect(p.careerSubApps).toBe(12);
  });

  it('raises every area when a player develops, not just the signature stat', () => {
    // enough XP to guarantee at least one whole-point bump
    const fwd = makePlayer({ position: 'FWD', age: 20, attacking: 60, defending: 30, midfield: 45, potential: 95 });
    const before = { ...fwd.attrs };
    for (let i = 0; i < 10; i++) applyTrainingProgression(fwd);

    expect(fwd.attrs.attacking).toBeGreaterThan(before.attacking ?? 0);
    expect(fwd.attrs.defending).toBeGreaterThan(before.defending ?? 0);
    expect(fwd.attrs.midfield).toBeGreaterThan(before.midfield ?? 0);
    // identity preserved: the gaps between areas are unchanged (all moved equally)
    expect((fwd.attrs.attacking ?? 0) - (fwd.attrs.defending ?? 0)).toBe(
      (before.attacking ?? 0) - (before.defending ?? 0),
    );
  });
});

describe('cards and injuries', () => {
  const card = (type: CardEvent['type'], secondYellow = false): CardEvent => ({
    minute: 30,
    clubId: 'C',
    playerId: 'x',
    type,
    secondYellow,
  });
  const injury = (matchesOut: number): InjuryEvent => ({ minute: 30, clubId: 'C', playerId: 'x', matchesOut });

  it('tallies a yellow card to the season and career totals', () => {
    const p = makePlayer({ position: 'DEF' });
    applyCard(p, card('yellow'));
    applyCard(p, card('yellow'));
    expect(p.seasonYellowCards).toBe(2);
    expect(p.careerYellowCards).toBe(2);
    expect(p.seasonRedCards).toBe(0);
    expect(p.suspendedMatches ?? 0).toBe(0); // a booking doesn't sideline you
  });

  it('tallies a red card and suspends the player', () => {
    const p = makePlayer({ position: 'MID' });
    applyCard(p, card('red', true));
    expect(p.seasonRedCards).toBe(1);
    expect(p.careerRedCards).toBe(1);
    expect(p.suspendedMatches).toBe(SIM.RED_SUSPENSION);
  });

  it('sidelines an injured player, keeping the worse of overlapping knocks', () => {
    const p = makePlayer({ position: 'FWD' });
    applyInjury(p, injury(2));
    expect(p.injuredMatches).toBe(2);
    applyInjury(p, injury(5));
    expect(p.injuredMatches).toBe(5); // a worse injury extends the lay-off
    applyInjury(p, injury(1));
    expect(p.injuredMatches).toBe(5); // a lighter knock never shortens it
  });
});

describe('form / momentum', () => {
  const fresh = () => makePlayer({ position: 'MID', age: 26, potential: 70 });
  const card = (type: CardEvent['type']): CardEvent => ({ minute: 30, clubId: 'C', playerId: 'x', type });
  const injury = (matchesOut: number): InjuryEvent => ({ minute: 30, clubId: 'C', playerId: 'x', matchesOut });

  it('rises on a win and falls on a loss', () => {
    const won = fresh();
    const lost = fresh();
    applyMatchProgression(won, rating(6.5), { score: 1, oppExpected: 0.5 });
    applyMatchProgression(lost, rating(6.5), { score: 0, oppExpected: 0.5 });
    expect(won.form).toBeGreaterThan(0);
    expect(lost.form).toBeLessThan(0);
  });

  it('rewards an upset win more than an expected one, and dents a loss to a giant less', () => {
    const upset = fresh();
    const routine = fresh();
    applyMatchProgression(upset, rating(6.5), { score: 1, oppExpected: 0.1 }); // beat a favourite
    applyMatchProgression(routine, rating(6.5), { score: 1, oppExpected: 0.9 }); // beat a minnow
    expect(upset.form).toBeGreaterThan(routine.form);

    const toGiant = fresh();
    const toMinnow = fresh();
    applyMatchProgression(toGiant, rating(6.5), { score: 0, oppExpected: 0.1 });
    applyMatchProgression(toMinnow, rating(6.5), { score: 0, oppExpected: 0.9 });
    expect(toGiant.form).toBeGreaterThan(toMinnow.form); // losing to a giant hurts less
  });

  it('treats a draw as opponent-aware (upset vs a giant, negative vs a minnow, ~0 at parity)', () => {
    const vsGiant = fresh();
    const vsParity = fresh();
    const vsMinnow = fresh();
    applyMatchProgression(vsGiant, rating(6.5), { score: 0.5, oppExpected: 0.1 });
    applyMatchProgression(vsParity, rating(6.5), { score: 0.5, oppExpected: 0.5 });
    applyMatchProgression(vsMinnow, rating(6.5), { score: 0.5, oppExpected: 0.9 });
    expect(vsGiant.form).toBeGreaterThan(0);
    expect(vsParity.form).toBeCloseTo(0, 5);
    expect(vsMinnow.form).toBeLessThan(0);
  });

  it('adds opponent-scaled bonuses for goals', () => {
    const vsStrong = fresh();
    const vsWeak = fresh();
    applyMatchProgression(vsStrong, rating(7, 1, 0), { score: 1, oppExpected: 0.1 });
    applyMatchProgression(vsWeak, rating(7, 1, 0), { score: 1, oppExpected: 0.9 });
    expect(vsStrong.form).toBeGreaterThan(vsWeak.form);
  });

  it('credits a clean sheet only to keepers and defenders', () => {
    const def = makePlayer({ position: 'DEF', age: 26 });
    const fwd = makePlayer({ position: 'FWD', age: 26 });
    applyMatchProgression(def, rating(6.5), { score: 0.5, oppExpected: 0.5, cleanSheet: true });
    applyMatchProgression(fwd, rating(6.5), { score: 0.5, oppExpected: 0.5, cleanSheet: true });
    expect(def.form).toBeGreaterThan(fwd.form);
    expect(fwd.form).toBeCloseTo(0, 5);
  });

  it('decays toward zero over a quiet appearance', () => {
    const p = fresh();
    p.form = 4;
    applyMatchProgression(p, rating(6.5), { score: 0.5, oppExpected: 0.5 });
    expect(p.form).toBeCloseTo(4 * (1 - FORM.DECAY), 5);
  });

  it('clamps to the configured range', () => {
    const p = fresh();
    for (let i = 0; i < 20; i++) applyMatchProgression(p, rating(9, 3, 2), { score: 1, oppExpected: 0.05 });
    expect(p.form).toBeLessThanOrEqual(FORM.MAX);
    expect(p.form).toBeGreaterThan(FORM.MAX - 1e-6);
  });

  it('couples development to form — good form grows a player harder', () => {
    const inForm = makePlayer({ position: 'FWD', age: 20, attacking: 50, potential: 90 });
    const outOfForm = makePlayer({ position: 'FWD', age: 20, attacking: 50, potential: 90 });
    inForm.form = 5;
    outOfForm.form = -5;
    applyMatchProgression(inForm, rating(7.5), { score: 0.5, oppExpected: 0.5 });
    applyMatchProgression(outOfForm, rating(7.5), { score: 0.5, oppExpected: 0.5 });
    expect(inForm.growthXp).toBeGreaterThan(outOfForm.growthXp);
  });

  it('a booking dents form, softened against a stronger opponent', () => {
    const vsStrong = makePlayer({ position: 'DEF' });
    const vsWeak = makePlayer({ position: 'DEF' });
    applyCard(vsStrong, card('yellow'), rewardMultiplierFromExpected(0.1)); // big opp -> mult > 1 -> softer
    applyCard(vsWeak, card('yellow'), rewardMultiplierFromExpected(0.9)); // small opp -> mult < 1 -> harsher
    expect(vsStrong.form).toBeLessThan(0);
    expect(vsWeak.form).toBeLessThan(vsStrong.form);
  });

  it('docks form on injury, scaled by lay-off length, and caps the hit', () => {
    const light = makePlayer({ position: 'FWD' });
    const heavy = makePlayer({ position: 'FWD' });
    const huge = makePlayer({ position: 'FWD' });
    applyInjury(light, injury(1), () => 1);
    applyInjury(heavy, injury(6), () => 1);
    applyInjury(huge, injury(100), () => 1);
    expect(light.form).toBeLessThan(0);
    expect(heavy.form).toBeLessThan(light.form);
    expect(huge.form).toBeCloseTo(-FORM.INJURY_MAX, 5);
  });

  it('comes back unaffected on a low random roll, and is untouched with no rng', () => {
    const lucky = makePlayer({ position: 'FWD' });
    applyInjury(lucky, injury(5), () => 0);
    expect(lucky.form).toBe(0);

    const unitCaller = makePlayer({ position: 'FWD' });
    unitCaller.form = 2;
    applyInjury(unitCaller, injury(3));
    expect(unitCaller.form).toBe(2);
  });
});
