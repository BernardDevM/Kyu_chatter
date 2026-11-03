import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WsAuthGuard } from '../../src/common/guards/ws-auth.guard.js';
import { WsThrottleGuard } from '../../src/common/guards/ws-throttle.guard.js';
import type { RedisService } from '../../src/realtime/redis.service.js';

describe('WebSocket Guards', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockWsContext(
    socketData: Record<string, unknown> = {},
    handshake: Record<string, unknown> = {},
    socketId = 'socket-1',
  ): ExecutionContext {
    const mockSocket = {
      id: socketId,
      data: socketData,
      handshake: {
        headers: {},
        auth: {},
        ...handshake,
      },
    } as unknown as Socket;

    return {
      switchToWs: () => ({
        getClient: () => mockSocket,
      }),
    } as unknown as ExecutionContext;
  }

  describe('WsAuthGuard', () => {
    const guard = new WsAuthGuard();

    it('allows access if socket is already authenticated in client.data', async () => {
      const ctx = createMockWsContext({ user: { id: 'usr-1' } });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('authenticates via dev header x-dev-user-id in dev mode when ALLOW_DEV_USER_HEADER=true', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'true';
      process.env.NODE_ENV = 'development';

      const ctx = createMockWsContext({}, { headers: { 'x-dev-user-id': 'usr-dev' } });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);

      const client = ctx.switchToWs().getClient() as Socket;
      expect(client.data.user.id).toBe('usr-dev');
    });

    it('authenticates via handshake.auth.userId in dev mode when ALLOW_DEV_USER_HEADER=true', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'true';
      process.env.NODE_ENV = 'development';

      const ctx = createMockWsContext({}, { auth: { userId: 'usr-auth-dev' } });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);

      const client = ctx.switchToWs().getClient() as Socket;
      expect(client.data.user.id).toBe('usr-auth-dev');
    });

    it('IGNORES dev identity in production even if ALLOW_DEV_USER_HEADER=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_USER_HEADER = 'true';

      const ctxWithHeader = createMockWsContext({}, { headers: { 'x-dev-user-id': 'usr-attacker' } });
      await expect(guard.canActivate(ctxWithHeader)).rejects.toThrow(WsException);

      const ctxWithAuth = createMockWsContext({}, { auth: { userId: 'usr-attacker' } });
      await expect(guard.canActivate(ctxWithAuth)).rejects.toThrow(WsException);
    });

    it('IGNORES dev identity when ALLOW_DEV_USER_HEADER=false', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_USER_HEADER = 'false';

      const ctx = createMockWsContext({}, { headers: { 'x-dev-user-id': 'usr-dev' } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
    });

    it('throws WsException if unauthenticated', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'false';
      const ctx = createMockWsContext({}, {});
      await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
    });
  });

  describe('WsThrottleGuard', () => {
    describe('in-memory fallback', () => {
      const mockRedis = {
        isReady: () => false,
      } as unknown as RedisService;
      const guard = new WsThrottleGuard(mockRedis);

      it('allows events within rate limit', async () => {
        const ctx = createMockWsContext({}, {}, 'socket-throttle-test');
        for (let i = 0; i < 30; i++) {
          expect(await guard.canActivate(ctx)).toBe(true);
        }
      });

      it('throws WsException when rate limit is exceeded', async () => {
        const ctx = createMockWsContext({}, {}, 'socket-spam');
        for (let i = 0; i < 30; i++) {
          await guard.canActivate(ctx);
        }
        await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
      });
    });

    describe('Redis rate limiter pipeline', () => {
      it('calls set with EX TTL NX and incr in pipeline', async () => {
        const mockPipeline = {
          set: vi.fn().mockReturnThis(),
          incr: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([
            [null, 'OK'],
            [null, 1],
          ]),
        };

        const mockRedis = {
          isReady: () => true,
          pipeline: () => mockPipeline,
        } as unknown as RedisService;

        const guard = new WsThrottleGuard(mockRedis);
        const ctx = createMockWsContext({ user: { id: 'usr-redis' } }, {}, 'socket-redis-1');

        const allowed = await guard.canActivate(ctx);
        expect(allowed).toBe(true);
        expect(mockPipeline.set).toHaveBeenCalledWith(
          'ratelimit:ws:user:usr-redis',
          '0',
          'EX',
          5,
          'NX',
        );
        expect(mockPipeline.incr).toHaveBeenCalledWith('ratelimit:ws:user:usr-redis');
      });

      it('throws WsException when Redis counter exceeds limit', async () => {
        const mockPipeline = {
          set: vi.fn().mockReturnThis(),
          incr: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([
            [null, 'OK'],
            [null, 31],
          ]),
        };

        const mockRedis = {
          isReady: () => true,
          pipeline: () => mockPipeline,
        } as unknown as RedisService;

        const guard = new WsThrottleGuard(mockRedis);
        const ctx = createMockWsContext({ user: { id: 'usr-spam' } }, {}, 'socket-redis-2');

        await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
      });
    });
  });
});
