/**
 * Name pools for world generation. Player names and club names are invented so
 * the generated world carries no real-player likeness, club crest, or league IP
 * exposure. Countries and player nationalities use REAL nation names (those carry
 * no IP), so the world reads naturally — fictional clubs and players, real flags.
 * Combinations give plenty of variety; exact uniqueness is guaranteed by ids.
 */

export const FIRST_NAMES: string[] = [
  'Aldo', 'Bram', 'Cyrus', 'Dario', 'Emil', 'Falk', 'Gael', 'Hugo', 'Ivo', 'Jonas',
  'Kai', 'Lewin', 'Milo', 'Nuno', 'Osei', 'Pavel', 'Quill', 'Remy', 'Soren', 'Tibor',
  'Ugo', 'Viktor', 'Wes', 'Xander', 'Yann', 'Zeno', 'Arto', 'Borys', 'Cedric', 'Demir',
  'Elias', 'Florin', 'Goran', 'Hector', 'Idris', 'Joel', 'Kasper', 'Leon', 'Mads', 'Niko',
  'Ola', 'Pelle', 'Rasmus', 'Stig', 'Tomas', 'Uros', 'Vito', 'Wim', 'Anton', 'Basil',
];

export const LAST_NAMES: string[] = [
  'Aaltonen', 'Brandt', 'Caron', 'Drazic', 'Eberhardt', 'Falkner', 'Garr', 'Halvorsen',
  'Ibsen', 'Jovic', 'Kallio', 'Lindqvist', 'Marek', 'Novak', 'Ortiz', 'Pajari', 'Quist',
  'Roos', 'Salko', 'Tamm', 'Ulriksen', 'Varga', 'Wendt', 'Yilmaz', 'Zima', 'Ackart',
  'Bauwens', 'Cole', 'Demir', 'Eklund', 'Fenwick', 'Grootveld', 'Haas', 'Ingram', 'Jeric',
  'Korhonen', 'Laczko', 'Moreau', 'Nilsen', 'Osterberg', 'Pernik', 'Rauta', 'Sandor',
  'Tervo', 'Uddin', 'Vasquez', 'Westra', 'Yates', 'Zoric', 'Albon', 'Brecht', 'Cisse',
  'Dahl', 'Engen', 'Fontaine', 'Gronkjaer', 'Hovland', 'Ilic', 'Jansa', 'Kovac', 'Larsen',
  'Madsen', 'Neri', 'Ostrowski', 'Petit', 'Rask', 'Storm', 'Turi', 'Vidic', 'Wolff', 'Zander',
];

// Real nations a generated player can hail from — a broad spread across
// confederations for variety. A player's nationality is independent of the
// country he plays in (the world has an open transfer market).
export const NATIONALITIES: string[] = [
  'England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal', 'Brazil',
  'Argentina', 'Belgium', 'Croatia', 'Denmark', 'Sweden', 'Norway', 'Poland', 'Switzerland',
  'Austria', 'Greece', 'Turkey', 'Japan', 'United States', 'Mexico', 'Nigeria', 'Senegal',
  'Colombia', 'Uruguay', 'Ghana', 'Morocco',
];

// Real countries that host the leagues, each with its own division pyramid. Only
// the first CONTENT.COUNTRY_COUNT are used, so the strongest footballing nations
// lead the list.
export const COUNTRIES: string[] = [
  'England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal', 'Brazil',
];

/**
 * Division names by tier, top first: `TIER_SUFFIXES[0]` is the top flight. A
 * league is named `${country} ${TIER_SUFFIXES[tier - 1]}` (e.g. "Albia First
 * Division"). Lower index = higher tier, so winning the Second Division earns
 * promotion to the First Division.
 */
export const TIER_SUFFIXES: string[] = [
  'First Division',
  'Second Division',
  'Third Division',
  'Fourth Division',
];

// city-ish prefixes for club names (invented)
export const CLUB_PLACES: string[] = [
  'Ashford', 'Bryne', 'Calder', 'Dunmore', 'Elsby', 'Fenwick', 'Grimsdale', 'Hartwell',
  'Inverel', 'Jarrow', 'Kelvin', 'Larkhall', 'Morley', 'Norwood', 'Oakley', 'Penhall',
  'Quarry', 'Rosvik', 'Stonebridge', 'Thornby', 'Ullsund', 'Vellmar', 'Westcliff', 'Yarrow',
  'Aldermoor', 'Blackmere', 'Carrow', 'Dalry', 'Eastvale', 'Fairholm', 'Greenmoss', 'Highmark',
  'Ironside', 'Kingsmere', 'Lochend', 'Marsh End', 'Northgate', 'Oldcastle', 'Redhaven', 'Sandwell',
];

export const CLUB_SUFFIXES: string[] = [
  'United', 'City', 'FC', 'Athletic', 'Town', 'Rovers', 'Wanderers', 'Albion',
  'County', 'Dynamo', 'Sporting', 'Olympic',
];

// short 3-letter code helper input — derived in content.ts from the chosen name
