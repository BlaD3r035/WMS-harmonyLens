import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '@harmonylens/shared';
import { env } from '../config/env.js';
import { DatabaseService } from '../db/database.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { loginSchema } from '../users/user.schemas.js';
import type { LoginDto } from '../users/user.schemas.js';
import { CurrentUser, Public } from './decorators.js';
import { LoginThrottle } from './login-throttle.js';
import { verifyPassword } from './password.js';
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  TokenService,
} from './token.service.js';

interface LoginRow {
  id: string;
  full_name: string;
  email: string;
  role: AuthUser['role'];
  password_hash: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: TokenService,
    private readonly throttle: LoginThrottle,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const throttleKey = `${req.ip}|${dto.email}`;
    if (this.throttle.isBlocked(throttleKey)) {
      throw new HttpException(
        'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.',
        429,
      );
    }

    const row = await this.db.one<LoginRow>(
      `SELECT id, full_name, email, role, password_hash
       FROM users WHERE email = $1 AND is_active`,
      [dto.email],
    );
    if (!(await verifyPassword(dto.password, row?.password_hash)) || !row) {
      this.throttle.recordFailure(throttleKey);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    this.throttle.reset(throttleKey);
    res.cookie(SESSION_COOKIE, await this.tokens.sign(row.id), {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      maxAge: SESSION_SECONDS * 1000,
      path: '/',
    });
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
