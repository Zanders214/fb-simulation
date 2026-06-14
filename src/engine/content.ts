import { overall } from './attrs';
import { CONTENT, POSITION_FACETS } from './config';
import {
  CLUB_PLACES,
  CLUB_SUFFIXES,
  COUNTRIES,
  FIRST_NAMES,
  LAST_NAMES,
  NATIONALITIES,
  TIER_SUFFIXES,
} from './names';
import { gaussian, randInt, type Rng, streamFor } from './rng';
import { initialBudget } from './transfers';
import type { Club, Country, League, Player, Position, World } from './types';
import { clamp } from './util';

// Salts give each entity an independent, order-independent PRNG stream so the
// world is byte-stable for a given seed regardless of generation order.
const SALT = { LEAGUE: 101, CLUB: 211, PLAYER: 307 } as const;

/** Average squad reputation for a tier (1 = top). Clamped to the table's range. */
function tierRepMean(tier: number): number {
  const means = CONTENT.TIER_REP_MEAN;
  return means[Math.min(tier - 1, means.length - 1)];
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

const PALETTE = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
  '#16a085', '#2c3e50', '#f39c12', '#7f8c8d', '#e84393',
];

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shortCode(place: string): string {
  const letters = place.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.length >= 3 ? letters.slice(0, 3) : (letters + 'FCX').slice(0, 3));
}

function pickClubName(
  rng: Rng,
  usedPlaces: Set<string>,
  usedShort: Set<string>,
): { name: string; shortName: string } {
  for (let tries = 0; tries < 80; tries++) {
    const place = pick(rng, CLUB_PLACES);
    const suffix = pick(rng, CLUB_SUFFIXES);
    const short = shortCode(place);
    if (usedPlaces.has(place) || usedShort.has(short)) continue;
    usedPlaces.add(place);
    usedShort.add(short);
    return { name: `${place} ${suffix}`, shortName: short };
  }
  // fallback: guarantee a unique short code
  let n = usedShort.size + 1;
  let short = `C${n}`;
  while (usedShort.has(short)) short = `C${++n}`;
  usedShort.add(short);
  return { name: `City ${n}`, shortName: short };
}

function pickColors(rng: Rng): [string, string] {
  const a = pick(rng, PALETTE);
  let b = pick(rng, PALETTE);
  if (b === a) b = '#ecf0f1';
  return [a, b];
}

/** Ages cluster around the mid-20s (mean of two uniforms = central tendency). */
function pickAge(rng: Rng): number {
  return Math.round((randInt(rng, 17, 36) + randInt(rng, 17, 36)) / 2);
}

/** Growth headroom above current overall — younger players have more potential. */
function potentialHeadroom(rng: Rng, age: number): number {
  if (age <= 20) return randInt(rng, 6, 18);
  if (age <= 24) return randInt(rng, 3, 12);
  if (age <= 28) return randInt(rng, 0, 5);
  return 0;
}

function generatePlayer(rng: Rng, id: string, clubId: string, position: Position, clubRep: number): Player {
  const base = clamp(gaussian(rng, clubRep, 7), 30, 95);
  const facet = POSITION_FACETS[position];
  const noise = () => gaussian(rng, 0, CONTENT.STAT_NOISE_SD);
  const attrs = {
    attacking: Math.round(clamp(base + facet.attacking + noise(), 1, 99)),
    defending: Math.round(clamp(base + facet.defending + noise(), 1, 99)),
    midfield: Math.round(clamp(base + facet.midfield + noise(), 1, 99)),
  };
  const firstName = pick(rng, FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const age = pickAge(rng);

  const player: Player = {
    id,
    clubId,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    nationality: pick(rng, NATIONALITIES),
    age,
    position,
    attrs,
    potential: 0,
    form: 0,
    growthXp: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonApps: 0,
    seasonCleanSheets: 0,
    seasonYellowCards: 0,
    seasonRedCards: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerApps: 0,
    careerCleanSheets: 0,
    careerYellowCards: 0,
    careerRedCards: 0,
    peakValue: 0,
  };

  const ov = overall(player);
  player.potential = clamp(ov + potentialHeadroom(rng, age), ov, 99);
  return player;
}

function generateSquad(seed: number, li: number, ci: number, club: Club): Player[] {
  const out: Player[] = [];
  let idx = 0;
  for (const pos of POSITIONS) {
    const count = CONTENT.POSITION_QUOTA[pos];
    for (let k = 0; k < count; k++) {
      const pr = streamFor(seed, SALT.PLAYER, li, ci, idx);
      out.push(generatePlayer(pr, `${club.id}_P${idx}`, club.id, pos, club.reputation));
      idx++;
    }
  }
  return out;
}

/** Generate one league (tier `tier` of `countryId`) and all of its clubs + players. */
function generateLeague(
  seed: number,
  li: number,
  countryName: string,
  countryId: string,
  tier: number,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
): League {
  const leagueId = `L${li}`;
  const league: League = {
    id: leagueId,
    name: `${countryName} ${TIER_SUFFIXES[tier - 1] ?? `Tier ${tier}`}`,
    country: countryName,
    countryId,
    tier,
    clubIds: [],
  };
  const usedPlaces = new Set<string>();
  const usedShort = new Set<string>();
  const repMean = tierRepMean(tier);

  for (let ci = 0; ci < CONTENT.CLUBS_PER_LEAGUE; ci++) {
    const cr = streamFor(seed, SALT.CLUB, li, ci);
    const clubId = `${leagueId}_C${ci}`;
    const { name, shortName } = pickClubName(cr, usedPlaces, usedShort);
    const reputation = Math.round(
      clamp(gaussian(cr, repMean, CONTENT.REP_SD), CONTENT.REP_MIN, CONTENT.REP_MAX),
    );
    const [primaryColor, secondaryColor] = pickColors(cr);
    const club: Club = {
      id: clubId,
      leagueId,
      name,
      shortName,
      reputation,
      budget: initialBudget(reputation),
      primaryColor,
      secondaryColor,
      playerIds: [],
    };

    for (const p of generateSquad(seed, li, ci, club)) {
      players[p.id] = p;
      club.playerIds.push(p.id);
    }

    clubs[clubId] = club;
    league.clubIds.push(clubId);
  }

  return league;
}

/**
 * Generate the entire world deterministically from a single seed: a set of
 * countries, each running a stacked pyramid of `TIERS_PER_COUNTRY` leagues
 * (top → bottom), with higher tiers fielding stronger, richer clubs. Same seed +
 * same generatorVersion => identical world.
 *
 * League ids are assigned in pyramid order (`L0` = country 0 / tier 1), so the
 * top flight of the first country is always `L0`.
 */
export function generateWorld(seed: number, generatorVersion = CONTENT.GENERATOR_VERSION): World {
  const countries: Record<string, Country> = {};
  const leagues: Record<string, League> = {};
  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};

  let li = 0;
  for (let co = 0; co < CONTENT.COUNTRY_COUNT; co++) {
    const countryId = `CT${co}`;
    const countryName = COUNTRIES[co % COUNTRIES.length];
    const country: Country = { id: countryId, name: countryName, leagueIds: [] };

    for (let tier = 1; tier <= CONTENT.TIERS_PER_COUNTRY; tier++) {
      const league = generateLeague(seed, li, countryName, countryId, tier, clubs, players);
      leagues[league.id] = league;
      country.leagueIds.push(league.id);
      li++;
    }

    countries[countryId] = country;
  }

  return { seed, generatorVersion, countries, leagues, clubs, players };
}
