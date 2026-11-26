import { stockState } from './inventory.module.js';

describe('stockState (HU11)', () => {
  it('is agotada with no available units, even if the minimum is 0', () => {
    expect(stockState(0, 0)).toBe('agotada');
    expect(stockState(0, 10)).toBe('agotada');
  });
  it('is bajo at or below the minimum', () => {
    expect(stockState(10, 10)).toBe('bajo');
    expect(stockState(3, 10)).toBe('bajo');
  });
  it('is ok above the minimum', () => {
    expect(stockState(11, 10)).toBe('ok');
    expect(stockState(1, 0)).toBe('ok');
  });
});
