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

function resolveCrossSiteCookies(): boolean {
  const explicit = process.env.BETTER_AUTH_CROSS_SITE_COOKIES;

  if (explicit !== undefined) {
    return explicit === 'true';
  }

  return (
    process.env.NODE_ENV === 'production' &&
    (process.env.BETTER_AUTH_URL ?? '').startsWith('https://')
  );
}

const secureCookiesEnv = process.env.BETTER_AUTH_SECURE_COOKIES;
const crossSiteCookies = resolveCrossSiteCookies();

const advanced = crossSiteCookies
  ? {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: 'none' as const,
        secure: true,
      },
    }
  : secureCookiesEnv !== undefined
    ? { useSecureCookies: secureCookiesEnv === 'true' }
    : undefined;

const rateLimitEnv = process.env.BETTER_AUTH_RATE_LIMIT_ENABLED;
const rateLimit =
  rateLimitEnv !== undefined
    ? { enabled: rateLimitEnv !== 'false' }
    : undefined;

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

    ...(advanced ? { advanced } : {}),
    ...(rateLimit ? { rateLimit } : {}),

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