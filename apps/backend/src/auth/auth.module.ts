
import { Module } from '@nestjs/common';
import {
  AuthModule as BetterAuthNestModule,
} from '@thallesp/nestjs-better-auth';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createBetterAuth } from './better-auth.js';

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
})
export class AuthModule {}
