
import { Module } from '@nestjs/common';

import {
  AuthModule as BetterAuthNestModule,
} from '@thallesp/nestjs-better-auth';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { createBetterAuth } from './better-auth.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    PrismaModule,

    BetterAuthNestModule.forRootAsync({
      disableGlobalAuthGuard: true,
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createBetterAuth(prisma),
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService],

  exports: [AuthService],
})
export class AuthModule {}
