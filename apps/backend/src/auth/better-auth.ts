
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

// Optional environment knob: BETTER_AUTH_SECURE_COOKIES ('true'|'false')
// Mapped to advanced.useSecureCookies only when explicitly set.
// Needed because production mode over plain http://localhost can silently drop Secure cookies.
const secureCookiesEnv = process.env.BETTER_AUTH_SECURE_COOKIES;
const advanced =
  secureCookiesEnv !== undefined
    ? { useSecureCookies: secureCookiesEnv === 'true' }
    : undefined;

// Optional environment knob: BETTER_AUTH_RATE_LIMIT_ENABLED ('true'|'false')
// Disables Better Auth's built-in rate limit when set to 'false'; for load testing ONLY.
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
