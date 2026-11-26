import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'hl_session';
export const SESSION_SECONDS = 8 * 60 * 60;

const key = new TextEncoder().encode(env.JWT_SECRET);

@Injectable()
export class TokenService {
  sign(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_SECONDS}s`)
      .sign(key);
  }

  /** Returns the user id, or null when the token is invalid or expired. */
  async verify(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
