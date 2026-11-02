
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { getAllowedOrigins } from '../common/utils/cors.util.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createBetterAuth(prisma: PrismaService) {
  return betterAuth({
    appName: 'Kyu Chatter',

    baseURL: requiredEnv('BETTER_AUTH_URL'),

    secret: requiredEnv('BETTER_AUTH_SECRET'),

    trustedOrigins: getAllowedOrigins(),

    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    plugins: [bearer()],

    emailAndPassword: {
      enabled: true,
    },

    socialProviders: {
      google: {
        clientId: requiredEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
  });
}
