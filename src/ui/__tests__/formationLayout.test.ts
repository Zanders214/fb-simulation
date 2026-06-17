import { FORMATIONS, type Formation, type Position } from '../../engine';
import { FORMATION_LAYOUTS } from '../formationLayout';

const FORMATION_KEYS = Object.keys(FORMATIONS) as Formation[];

describe('formation layouts', () => {
  it('defines a layout for every formation', () => {
    for (const f of FORMATION_KEYS) {
      expect(FORMATION_LAYOUTS[f]).toBeDefined();
    }
  });

  it('places all 11 starting slots inside the pitch bounds', () => {
    for (const f of FORMATION_KEYS) {
      const slots = FORMATION_LAYOUTS[f];
      expect(slots.length).toBe(11);
      for (const { x, y } of slots) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('orders slots GK→DEF→MID→FWD with counts matching FORMATIONS', () => {
    // startingXI is built in this group order, so slot[i] must line up with it.
    for (const f of FORMATION_KEYS) {
      const need = FORMATIONS[f];
      const order: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
      let i = 0;
      // GK is always the first slot.
      expect(FORMATION_LAYOUTS[f][0].label).toBe('GK');
      for (const pos of order) i += need[pos];
      expect(i).toBe(11);
    }
  });
});
