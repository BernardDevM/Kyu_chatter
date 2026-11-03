import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from '../../src/realtime/redis-io.adapter.js';

describe('RedisIoAdapter fail-fast and fallback', () => {
  const originalEnv = process.env;
  const mockApp = {} as unknown as INestApplicationContext;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws in production mode when Redis connection fails or times out', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:65530';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '100';

    const adapter = new RedisIoAdapter(mockApp);
    await expect(adapter.connectToRedis()).rejects.toThrow();
    await adapter.close();
  });

  it('throws when REDIS_REQUIRED=true and Redis connection fails', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_REQUIRED = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:65530';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '100';

    const adapter = new RedisIoAdapter(mockApp);
    await expect(adapter.connectToRedis()).rejects.toThrow();
    await adapter.close();
  });

  it('falls back to in-memory without throwing in development mode', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_REQUIRED;
    process.env.REDIS_URL = 'redis://127.0.0.1:65530';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '100';

    const adapter = new RedisIoAdapter(mockApp);
    await expect(adapter.connectToRedis()).resolves.toBeUndefined();
    await adapter.close();
  });
});
