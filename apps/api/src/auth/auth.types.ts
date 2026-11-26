import type { Request } from 'express';
import type { AuthUser } from '@harmonylens/shared';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
