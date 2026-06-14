import { COUNTRIES, NATIONALITIES } from '../../engine/names';
import { flagFor } from '../format';

describe('flagFor', () => {
  it('maps known nationalities to their emoji flag', () => {
    expect(flagFor('Italy')).toBe('🇮🇹');
    expect(flagFor('Brazil')).toBe('🇧🇷');
    expect(flagFor('United States')).toBe('🇺🇸');
  });

  it('uses the UK flag for England', () => {
    expect(flagFor('England')).toBe('🇬🇧');
  });

  it('has a flag for every generated nationality', () => {
    for (const nation of NATIONALITIES) {
      // A mapped nation returns its flag, never the name fallback.
      expect(flagFor(nation)).not.toBe(nation);
    }
  });

  it('has a flag for every host country', () => {
    for (const country of COUNTRIES) {
      expect(flagFor(country)).not.toBe(country);
    }
  });

  it('falls back to the original string when unmapped', () => {
    expect(flagFor('Testland')).toBe('Testland');
  });
});
