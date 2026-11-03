import { Logger, type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  protected override readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(appOrHttpServer: INestApplicationContext) {
    super(appOrHttpServer);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const timeoutMs = parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10);
    const isRedisRequired =
      process.env.NODE_ENV === 'production' || process.env.REDIS_REQUIRED === 'true';

    try {
      this.pubClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });

      this.pubClient.on('error', (err) => {
        this.logger.warn(`Redis adapter pubClient error: ${err.message}`);
      });

      this.subClient = this.pubClient.duplicate();
      this.subClient.on('error', (err) => {
        this.logger.warn(`Redis adapter subClient error: ${err.message}`);
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Redis adapter connection timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        await Promise.race([
          Promise.all([this.pubClient.connect(), this.subClient.connect()]),
          timeoutPromise,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.logger.log(`Socket.IO Redis adapter connected successfully to ${redisUrl}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.close();

      if (isRedisRequired) {
        this.logger.error(
          `FATAL: Failed to connect Redis adapter in production/required mode: ${errMsg}`,
        );
        throw err instanceof Error ? err : new Error(errMsg);
      }

      this.logger.warn(
        `CROSS-NODE BROADCAST DISABLED: Failed to connect Redis adapter to ${redisUrl}: ${errMsg}. Falling back to default in-memory adapter.`,
      );
    }
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.IO server attached to Redis adapter for cross-node broadcasting');
    } else {
      this.logger.warn('Socket.IO running with default in-memory adapter (Redis adapter inactive)');
    }
    return server;
  }

  async close(): Promise<void> {
    if (this.pubClient) {
      await this.pubClient.quit().catch(() => this.pubClient?.disconnect());
      this.pubClient = null;
    }
    if (this.subClient) {
      await this.subClient.quit().catch(() => this.subClient?.disconnect());
      this.subClient = null;
    }
  }
}
