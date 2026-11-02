import { describe, it, expect } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WsAuthGuard } from '../../src/common/guards/ws-auth.guard.js';
import { WsThrottleGuard } from '../../src/common/guards/ws-throttle.guard.js';

describe('WebSocket Guards', () => {
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

    it('authenticates via dev header x-dev-user-id in dev mode', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'true';
      process.env.NODE_ENV = 'test';

      const ctx = createMockWsContext({}, { headers: { 'x-dev-user-id': 'usr-dev' } });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);

      const client = ctx.switchToWs().getClient() as Socket;
      expect(client.data.user.id).toBe('usr-dev');
    });

    it('throws WsException if unauthenticated', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'false';
      const ctx = createMockWsContext({}, {});
      await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
    });
  });

  describe('WsThrottleGuard', () => {
    const mockRedis = {
      isReady: () => false,
      incr: vi.fn(),
      expire: vi.fn(),
    } as any;
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
});
