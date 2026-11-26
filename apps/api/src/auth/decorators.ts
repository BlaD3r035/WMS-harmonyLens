import { SetMetadata, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@harmonylens/shared';
import type { AuthenticatedRequest } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Skips authentication for a route (login only). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the listed roles. `admin` always passes. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
