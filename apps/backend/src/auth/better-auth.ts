import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../prisma/prisma.service.js';

function envWithDefault(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

export function createBetterAuth(prisma: PrismaService) {
  const frontendOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: 'Kyu Chatter',

    baseURL: envWithDefault('BETTER_AUTH_URL', 'http://localhost:3000'),
    secret: envWithDefault('BETTER_AUTH_SECRET', 'dev-secret-kyu-chatter-12345678'),

    trustedOrigins: frontendOrigins.length > 0 ? frontendOrigins : ['http://localhost:3000', 'http://localhost:5173'],

    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    emailAndPassword: {
      enabled: true,
    },

    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {},
  });
}
