import { COUNTRIES, NATIONALITIES } from '../../engine/names';
import { flagFor, formLabel } from '../format';

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

describe('formLabel', () => {
  it.each<[number, string]>([
    [5, 'Prime'],
    [4.5, 'Prime'],
    [4, 'Excellent'],
    [3, 'Excellent'],
    [2, 'Good'],
    [1.5, 'Good'],
    [0, 'Average'],
    [-1, 'Average'],
    [-1.5, 'Poor'],
    [-3, 'Terrible'],
    [-4, 'Terrible'],
    [-4.5, 'Washed'],
    [-5, 'Washed'],
  ])('labels form %p as %p', (form, label) => {
    expect(formLabel(form)).toBe(label);
  });
});
