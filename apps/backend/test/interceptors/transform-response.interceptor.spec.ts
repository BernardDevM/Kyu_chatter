import { describe, it, expect, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor.js';

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();

  function createMockContext(
    path: string,
    statusCode = 200,
    type: 'http' | 'ws' | 'rpc' = 'http',
  ): {
    context: ExecutionContext;
    headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    const mockRequest = { originalUrl: path, url: path } as Request;
    const mockResponse = {
      statusCode,
      setHeader: vi.fn((key: string, val: string) => {
        headers[key] = val;
      }),
    } as unknown as Response;

    const context = {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    return { context, headers };
  }

  it('wraps regular API responses with success envelope and meta', async () => {
    const { context, headers } = createMockContext('/api/rooms', 200);
    const handler: CallHandler = {
      handle: () => of({ roomId: '123' }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler)) as {
      success: boolean;
      data: { roomId: string };
      meta: { nodeId: string; timestamp: string };
    };

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ roomId: '123' });
    expect(result.meta.nodeId).toBeDefined();
    expect(result.meta.timestamp).toBeDefined();
    expect(headers['X-Node-Id']).toBeDefined();
  });

  it('skips envelope for /health routes but sets X-Node-Id header', async () => {
    const { context, headers } = createMockContext('/health/live', 200);
    const handler: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    expect(result).toEqual({ status: 'ok' });
    expect(headers['X-Node-Id']).toBeDefined();
  });

  it('skips envelope for /api/auth routes', async () => {
    const { context, headers } = createMockContext('/api/auth/sign-in', 200);
    const handler: CallHandler = {
      handle: () => of({ token: 'abc' }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    expect(result).toEqual({ token: 'abc' });
    expect(headers['X-Node-Id']).toBeDefined();
  });

  it('skips envelope for /api/docs routes', async () => {
    const { context, headers } = createMockContext('/api/docs', 200);
    const handler: CallHandler = {
      handle: () => of('<html>swagger</html>'),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    expect(result).toBe('<html>swagger</html>');
    expect(headers['X-Node-Id']).toBeDefined();
  });

  it('skips envelope for 204 No Content responses', async () => {
    const { context, headers } = createMockContext('/api/rooms/123', 204);
    const handler: CallHandler = {
      handle: () => of(undefined),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    expect(result).toBeUndefined();
    expect(headers['X-Node-Id']).toBeDefined();
  });

  it('does not wrap WebSocket acks (they already use their own { ok, data } shape)', async () => {
    const { context, headers } = createMockContext('', 200, 'ws');
    const ack = { ok: true, roomId: 'room_1', data: { id: 'msg_1' } };
    const handler: CallHandler = { handle: () => of(ack) };

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toBe(ack);
    expect(headers['X-Node-Id']).toBeUndefined();
  });
});