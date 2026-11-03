import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAllowedOrigins,
  isOriginAllowed,
  corsOriginCallback,
} from '../../src/common/utils/cors.util.js';

describe('cors.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOW_LOCALHOST;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getAllowedOrigins', () => {
    it('returns default development origins when no env is set in non-production', () => {
      delete process.env.FRONTEND_URLS;
      delete process.env.FRONTEND_URL;
      process.env.NODE_ENV = 'development';

      const origins = getAllowedOrigins();
      expect(origins).toContain('http://localhost:5173');
      expect(origins).toContain('http://127.0.0.1:5173');
      expect(origins).toContain('http://localhost:3000');
    });

    it('merges custom FRONTEND_URLS with dev defaults in non-production', () => {
      process.env.FRONTEND_URLS = 'http://custom-client.local:8080';
      process.env.NODE_ENV = 'development';

      const origins = getAllowedOrigins();
      expect(origins).toContain('http://custom-client.local:8080');
      expect(origins).toContain('http://localhost:5173');
    });

    it('strictly returns configured origins in production mode', () => {
      process.env.FRONTEND_URLS = 'https://chat.example.com';
      process.env.NODE_ENV = 'production';

      const origins = getAllowedOrigins();
      expect(origins).toEqual(['https://chat.example.com']);
      expect(origins).not.toContain('http://localhost:5173');
    });

    it('falls back to the default production origin instead of throwing when unset', () => {
      delete process.env.FRONTEND_URLS;
      delete process.env.FRONTEND_URL;
      process.env.NODE_ENV = 'production';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(getAllowedOrigins()).toEqual(['https://kyu-chatter-2.vercel.app']);
    });

    it('strips trailing slashes and whitespace from configured origins', () => {
      process.env.FRONTEND_URLS = ' https://chat.example.com/ , https://b.example.com// ';
      process.env.NODE_ENV = 'production';

      expect(getAllowedOrigins()).toEqual([
        'https://chat.example.com',
        'https://b.example.com',
      ]);
    });

    it('adds localhost origins in production only when CORS_ALLOW_LOCALHOST=true', () => {
      process.env.FRONTEND_URLS = 'https://chat.example.com';
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOW_LOCALHOST = 'true';

      const origins = getAllowedOrigins();
      expect(origins).toContain('https://chat.example.com');
      expect(origins).toContain('http://localhost:5173');
    });
  });

  describe('isOriginAllowed', () => {
    it('allows requests with undefined origin (curl, mobile, server-to-server)', () => {
      expect(isOriginAllowed(undefined)).toBe(true);
    });

    it('allows any localhost or 127.0.0.1 port in non-production', () => {
      process.env.NODE_ENV = 'development';
      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:5174')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    });

    it('rejects unapproved external origins', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URLS = 'https://app.kyu.com';
      expect(isOriginAllowed('https://evil-site.com')).toBe(false);
    });

    it('rejects localhost in production by default', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URLS = 'https://app.kyu.com';
      expect(isOriginAllowed('http://localhost:5173')).toBe(false);
      expect(isOriginAllowed('http://localhost:4321')).toBe(false);
    });

    it('allows any localhost port in production when CORS_ALLOW_LOCALHOST=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URLS = 'https://app.kyu.com';
      process.env.CORS_ALLOW_LOCALHOST = 'true';
      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:4321')).toBe(true);
    });

    it('matches an allowed origin sent with a trailing slash', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URLS = 'https://app.kyu.com';
      expect(isOriginAllowed('https://app.kyu.com/')).toBe(true);
    });
  });

  describe('corsOriginCallback', () => {
    it('calls callback with null, true for allowed origins', () => {
      process.env.NODE_ENV = 'development';
      let errResult: Error | null = new Error('not called');
      let allowResult: boolean | undefined = false;

      corsOriginCallback('http://localhost:5173', (err, allow) => {
        errResult = err;
        allowResult = allow;
      });

      expect(errResult).toBeNull();
      expect(allowResult).toBe(true);
    });

    it('calls callback with null, false (no Error / no 500) for forbidden origins in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URLS = 'https://app.kyu.com';

      let errResult: Error | null = new Error('not called');
      let allowResult: boolean | undefined = true;

      corsOriginCallback('https://malicious.com', (err, allow) => {
        errResult = err;
        allowResult = allow;
      });

      expect(errResult).toBeNull();
      expect(allowResult).toBe(false);
    });
  });
});