
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../prisma/prisma.service.js';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createBetterAuth(prisma: PrismaService) {
  const frontendOrigins = (process.env.FRONTEND_URLS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: 'Kyu Chatter',

    baseURL: requiredEnv('BETTER_AUTH_URL'),
    secret: requiredEnv('BETTER_AUTH_SECRET'),

    trustedOrigins: frontendOrigins,

    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    emailAndPassword: {
      enabled: true,
    },

    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {}),
    },
  });
}
