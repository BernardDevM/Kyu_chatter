import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBetterAuth } from '../../src/auth/better-auth.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

describe('createBetterAuth knobs', () => {
  const originalEnv = process.env;
  const mockPrisma = {} as unknown as PrismaService;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('initializes with default options when knobs are unset', () => {
    delete process.env.BETTER_AUTH_SECURE_COOKIES;
    delete process.env.BETTER_AUTH_RATE_LIMIT_ENABLED;

    const auth = createBetterAuth(mockPrisma);
    expect(auth).toBeDefined();
    expect(auth.options.advanced?.useSecureCookies).toBeUndefined();
    expect(auth.options.rateLimit?.enabled).toBeUndefined();
  });

  it('maps BETTER_AUTH_SECURE_COOKIES to advanced.useSecureCookies', () => {
    process.env.BETTER_AUTH_SECURE_COOKIES = 'false';
    const authFalse = createBetterAuth(mockPrisma);
    expect(authFalse.options.advanced?.useSecureCookies).toBe(false);

    process.env.BETTER_AUTH_SECURE_COOKIES = 'true';
    const authTrue = createBetterAuth(mockPrisma);
    expect(authTrue.options.advanced?.useSecureCookies).toBe(true);
  });

  it('maps BETTER_AUTH_RATE_LIMIT_ENABLED=false to rateLimit.enabled=false', () => {
    process.env.BETTER_AUTH_RATE_LIMIT_ENABLED = 'false';
    const auth = createBetterAuth(mockPrisma);
    expect(auth.options.rateLimit?.enabled).toBe(false);
  });
});
