import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@harmonylens/shared';
import { DatabaseService } from '../db/database.service.js';
import { IS_PUBLIC, ROLES } from './decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SESSION_COOKIE, TokenService } from './token.service.js';

function readCookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

interface SessionRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

/**
 * Global guard: authenticates every route except @Public() ones, then applies
 * @Roles(). The user is reloaded from the database on each request so that
 * deactivating or changing a user takes effect immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const userId = token ? await this.tokens.verify(token) : null;
    if (!userId) throw new UnauthorizedException('Sesión no válida');

    const row = await this.db
      .one<SessionRow>(
        `SELECT id, full_name, email, role FROM users
         WHERE id = $1 AND is_active`,
        [userId],
      )
      .catch(() => undefined); // malformed uuid in a forged token -> unauthorized
    if (!row) throw new UnauthorizedException('Sesión no válida');

    request.user = {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
    };

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES,
      targets,
    );
    if (
      roles &&
      request.user.role !== 'admin' &&
      !roles.includes(request.user.role)
    ) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
