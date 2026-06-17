import type { ClubId, Fixture, TableRow } from './types';

/** Final score of a played fixture, from the full result (user's league) or the slim score (others). */
function scoreOf(f: Fixture): { homeGoals: number; awayGoals: number } | undefined {
  return f.result ?? f.score;
}

/** Compute the league table from played fixtures (3 pts win, 1 draw, 0 loss). */
export function computeTable(fixtures: Fixture[], clubIds: ClubId[]): TableRow[] {
  const rows: Record<ClubId, TableRow> = {};
  for (const id of clubIds) {
    rows[id] = { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  }

  for (const f of fixtures) {
    const score = scoreOf(f);
    if (!score) continue;
    const h = rows[f.homeClubId];
    const a = rows[f.awayClubId];
    if (!h || !a) continue;
    const hg = score.homeGoals;
    const ag = score.awayGoals;
    h.played++;
    a.played++;
    h.gf += hg;
    h.ga += ag;
    a.gf += ag;
    a.ga += hg;
    if (hg > ag) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (hg < ag) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }

  const arr = Object.values(rows);
  for (const r of arr) r.gd = r.gf - r.ga;
  // points, then goal difference, then goals for, then id (stable for determinism)
  arr.sort(
    (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.clubId.localeCompare(y.clubId),
  );
  return arr;
}
