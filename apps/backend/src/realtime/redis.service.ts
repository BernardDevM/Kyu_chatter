import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis, type ChainableCommander } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  onModuleInit(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const keyPrefix = process.env.REDIS_KEY_PREFIX || 'kyu:';

    this.client = new Redis(redisUrl, {
      keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Retrying Redis connection in ${delay}ms (attempt ${times})...`);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log(`Redis connected successfully to ${redisUrl} [prefix: ${keyPrefix}]`);
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });

    // Initiate non-blocking connection
    this.client.connect().catch((err) => {
      this.logger.warn(`Initial Redis connection failed: ${err.message}. Realtime features will retry.`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => this.client?.disconnect());
      this.isConnected = false;
      this.logger.log('Redis client disconnected cleanly.');
    }
  }

  /**
   * Returns the underlying ioredis client instance.
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Checks whether the Redis client is currently connected.
   */
  isReady(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }

  /**
   * Executes a healthcheck PING command.
   */
  async ping(): Promise<string> {
    if (!this.client) {
      throw new Error('Redis client is not initialized');
    }
    return this.client.ping();
  }

  /**
   * Retrieves string value by key.
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  /**
   * Sets string value with optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (!this.client) return null;
    if (ttlSeconds && ttlSeconds > 0) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  /**
   * Deletes one or more keys.
   */
  async del(...keys: string[]): Promise<number> {
    if (!this.client || keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /**
   * Adds a member with a numeric score to a sorted set (used for presence heartbeats).
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.zadd(key, score, member);
  }

  /**
   * Removes members from a sorted set.
   */
  async zrem(key: string, ...members: string[]): Promise<number> {
    if (!this.client || members.length === 0) return 0;
    return this.client.zrem(key, ...members);
  }

  /**
   * Returns the cardinality (count of elements) in a sorted set.
   */
  async zcard(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.zcard(key);
  }

  /**
   * Returns members in a score range.
   */
  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    if (!this.client) return [];
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * Removes members whose scores fall within the specified min/max range.
   */
  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number> {
    if (!this.client) return 0;
    return this.client.zremrangebyscore(key, min, max);
  }

  /**
   * Atomically increments a key counter.
   */
  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  /**
   * Sets TTL expiration on a key in seconds.
   */
  async expire(key: string, seconds: number): Promise<number> {
    if (!this.client) return 0;
    return this.client.expire(key, seconds);
  }

  /**
   * Creates a multi-command pipeline.
   */
  pipeline(): ChainableCommander | null {
    return this.client ? this.client.pipeline() : null;
  }
}
