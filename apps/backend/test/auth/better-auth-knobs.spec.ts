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
    delete process.env.BETTER_AUTH_CROSS_SITE_COOKIES;
    delete process.env.BETTER_AUTH_SECURE_COOKIES;
    delete process.env.BETTER_AUTH_RATE_LIMIT_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('initializes with default options when knobs are unset', async () => {
    const { createBetterAuth } = await import('../../src/auth/better-auth.js');
    const auth = createBetterAuth(mockPrisma);
    expect(auth).toBeDefined();
    expect(auth.options.advanced?.useSecureCookies).toBeUndefined();
    expect(auth.options.advanced?.defaultCookieAttributes).toBeUndefined();
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

  describe('cross-site cookies', () => {
    it('defaults to SameSite=None; Secure in production over https with no new env vars', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_URL = 'https://kyu-chatter.onrender.com';
      process.env.FRONTEND_URLS = 'https://kyu-chatter-2.vercel.app';

      const { createBetterAuth } = await import('../../src/auth/better-auth.js');
      const auth = createBetterAuth(mockPrisma);
      expect(auth.options.advanced?.useSecureCookies).toBe(true);
      expect(auth.options.advanced?.defaultCookieAttributes).toEqual({
        sameSite: 'none',
        secure: true,
      });
    });

    it('stays off in production over plain http (localhost demo)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_URL = 'http://localhost:8080';
      process.env.FRONTEND_URLS = 'http://localhost:5173';

      const { createBetterAuth } = await import('../../src/auth/better-auth.js');
      const auth = createBetterAuth(mockPrisma);
      expect(auth.options.advanced?.defaultCookieAttributes).toBeUndefined();
    });

    it('can be switched off explicitly in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_URL = 'https://kyu-chatter.onrender.com';
      process.env.FRONTEND_URLS = 'https://kyu-chatter-2.vercel.app';
      process.env.BETTER_AUTH_CROSS_SITE_COOKIES = 'false';

      const { createBetterAuth } = await import('../../src/auth/better-auth.js');
      const auth = createBetterAuth(mockPrisma);
      expect(auth.options.advanced?.defaultCookieAttributes).toBeUndefined();
    });

    it('can be switched on explicitly outside production', async () => {
      process.env.BETTER_AUTH_CROSS_SITE_COOKIES = 'true';

      const { createBetterAuth } = await import('../../src/auth/better-auth.js');
      const auth = createBetterAuth(mockPrisma);
      expect(auth.options.advanced?.defaultCookieAttributes).toEqual({
        sameSite: 'none',
        secure: true,
      });
    });

    it('forces Secure on even if BETTER_AUTH_SECURE_COOKIES=false while cross-site is on', async () => {
      process.env.BETTER_AUTH_CROSS_SITE_COOKIES = 'true';
      process.env.BETTER_AUTH_SECURE_COOKIES = 'false';

      const { createBetterAuth } = await import('../../src/auth/better-auth.js');
      const auth = createBetterAuth(mockPrisma);
      expect(auth.options.advanced?.useSecureCookies).toBe(true);
    });
  });
});