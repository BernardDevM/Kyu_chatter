
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';

import { AuthService } from './auth.service.js';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  getCurrentUser(
    @Session() session: UserSession,
  ) {
    return this.authService.getCurrentUser(session);
  }
}
