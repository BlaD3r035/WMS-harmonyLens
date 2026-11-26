import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AuthUser, UserSummary } from '@harmonylens/shared';
import { Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { registerSchema } from './user.schemas.js';
import type { RegisterDto } from './user.schemas.js';
import { UsersService } from './users.service.js';

/** User management is admin-only: there is no public self-registration. */
@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<UserSummary[]> {
    return this.users.list();
  }

  @Post()
  register(
    @Body(new ZodPipe(registerSchema)) dto: RegisterDto,
  ): Promise<AuthUser> {
    return this.users.create(dto);
  }
}
