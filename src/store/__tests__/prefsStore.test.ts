import { migratePrefs } from '../prefsStore';

describe('migratePrefs (v1 → v2)', () => {
  it('maps the heritage light/dark/system themes onto Broadcast', () => {
    expect(migratePrefs({ themePref: 'light' }, 1)).toEqual({ stylePref: 'broadcast', modePref: 'light' });
    expect(migratePrefs({ themePref: 'dark' }, 1)).toEqual({ stylePref: 'broadcast', modePref: 'dark' });
    expect(migratePrefs({ themePref: 'system' }, 1)).toEqual({ stylePref: 'broadcast', modePref: 'system' });
  });

  it('maps graphite onto Terminal dark', () => {
    expect(migratePrefs({ themePref: 'graphite' }, 1)).toEqual({ stylePref: 'terminal', modePref: 'dark' });
  });

  it('collapses removed palettes onto Broadcast dark', () => {
    for (const old of ['midnight', 'claret', 'sunset']) {
      expect(migratePrefs({ themePref: old }, 1)).toEqual({ stylePref: 'broadcast', modePref: 'dark' });
    }
  });

  it('falls back to the default for missing/unknown values', () => {
    expect(migratePrefs({}, 1)).toEqual({ stylePref: 'broadcast', modePref: 'system' });
    expect(migratePrefs({ themePref: 'neon' }, 1)).toEqual({ stylePref: 'broadcast', modePref: 'system' });
    expect(migratePrefs(undefined, 1)).toEqual({ stylePref: 'broadcast', modePref: 'system' });
  });
});
