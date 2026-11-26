import { LoginThrottle } from './login-throttle.js';

describe('LoginThrottle', () => {
  it('blocks after 8 failures and clears on reset', () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 7; i++) t.recordFailure('k');
    expect(t.isBlocked('k')).toBe(false);
    t.recordFailure('k');
    expect(t.isBlocked('k')).toBe(true);
    t.reset('k');
    expect(t.isBlocked('k')).toBe(false);
  });

  it('forgets failures after the 15 minute window', () => {
    const t = new LoginThrottle();
    const start = 1_000_000;
    for (let i = 0; i < 8; i++) t.recordFailure('k', start);
    expect(t.isBlocked('k', start + 14 * 60_000)).toBe(true);
    expect(t.isBlocked('k', start + 16 * 60_000)).toBe(false);
  });

  it('tracks keys independently', () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 8; i++) t.recordFailure('a');
    expect(t.isBlocked('b')).toBe(false);
  });
});
