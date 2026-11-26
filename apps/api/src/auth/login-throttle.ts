import { Injectable } from '@nestjs/common';

const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

/** In-memory brute-force guard keyed by client IP + email. Resets on restart. */
@Injectable()
export class LoginThrottle {
  private readonly failures = new Map<
    string,
    { count: number; since: number }
  >();

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (now - entry.since > WINDOW_MS) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.failures.get(key);
    if (!entry || now - entry.since > WINDOW_MS) {
      this.failures.set(key, { count: 1, since: now });
    } else {
      entry.count += 1;
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
