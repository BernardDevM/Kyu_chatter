import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

describe('createBetterAuth knobs', () => {
  const originalEnv = process.env;
  const mockPrisma = {} as unknown as PrismaService;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('initializes with default options when knobs are unset', async () => {
    delete process.env.BETTER_AUTH_SECURE_COOKIES;
    delete process.env.BETTER_AUTH_RATE_LIMIT_ENABLED;

    const { createBetterAuth } = await import('../../src/auth/better-auth.js');
    const auth = createBetterAuth(mockPrisma);
    expect(auth).toBeDefined();
    expect(auth.options.advanced?.useSecureCookies).toBeUndefined();
    expect(auth.options.rateLimit?.enabled).toBeUndefined();
  });

  it('maps BETTER_AUTH_SECURE_COOKIES to advanced.useSecureCookies', async () => {
    vi.resetModules();
    process.env.BETTER_AUTH_SECURE_COOKIES = 'false';
    let mod = await import('../../src/auth/better-auth.js');
    const authFalse = mod.createBetterAuth(mockPrisma);
    expect(authFalse.options.advanced?.useSecureCookies).toBe(false);

    vi.resetModules();
    process.env.BETTER_AUTH_SECURE_COOKIES = 'true';
    mod = await import('../../src/auth/better-auth.js');
    const authTrue = mod.createBetterAuth(mockPrisma);
    expect(authTrue.options.advanced?.useSecureCookies).toBe(true);
  });

  it('maps BETTER_AUTH_RATE_LIMIT_ENABLED=false to rateLimit.enabled=false', async () => {
    vi.resetModules();
    process.env.BETTER_AUTH_RATE_LIMIT_ENABLED = 'false';
    const { createBetterAuth } = await import('../../src/auth/better-auth.js');
    const auth = createBetterAuth(mockPrisma);
    expect(auth.options.rateLimit?.enabled).toBe(false);
  });
});
