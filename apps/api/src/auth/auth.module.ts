import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { LoginThrottle } from './login-throttle.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    TokenService,
    LoginThrottle,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
