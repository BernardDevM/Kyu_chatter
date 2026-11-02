import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthGuard } from '../../src/common/guards/auth.guard.js';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthGuard(reflector);
    process.env.ALLOW_DEV_USER_HEADER = 'true';
    process.env.NODE_ENV = 'test';
  });

  function createMockContext(
    path: string,
    headers: Record<string, string> = {},
    isPublic = false,
  ): ExecutionContext {
    const request = {
      originalUrl: path,
      url: path,
      headers,
    } as unknown as Request;

    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'PUBLIC') return isPublic;
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('allows access to public routes without authentication', async () => {
    const context = createMockContext('/api/test', {}, true);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access to /health routes unconditionally', async () => {
    const context = createMockContext('/health/live', {});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access to /api/auth routes unconditionally', async () => {
    const context = createMockContext('/api/auth/sign-in', {});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('authenticates via development header x-dev-user-id in dev mode', async () => {
    const context = createMockContext('/api/users/me', {
      'x-dev-user-id': 'usr_dev_123',
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const req = context.switchToHttp().getRequest() as Request & { user?: { id?: string } };
    expect(req.user?.id).toBe('usr_dev_123');
  });

  it('throws UnauthorizedException when no session and no dev header present', async () => {
    process.env.ALLOW_DEV_USER_HEADER = 'false';
    const context = createMockContext('/api/users/me', {});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
