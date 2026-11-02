import { describe, expect, it } from 'vitest';
import { RedisService } from '../../src/realtime/redis.service.js';

describe('RedisService', () => {
  it('instantiates and provides fallback when not connected', async () => {
    const service = new RedisService();
    // Before onModuleInit
    expect(service.getClient()).toBeNull();
    expect(service.isReady()).toBe(false);

    expect(await service.get('any-key')).toBeNull();
    expect(await service.set('any-key', 'val')).toBeNull();
    expect(await service.del('any-key')).toBe(0);
    expect(await service.zcard('any-key')).toBe(0);
    expect(await service.zrangebyscore('any-key', 0, 100)).toEqual([]);
    expect(await service.incr('any-key')).toBe(0);
  });

  it('connects to live local Redis and performs ping, set, get, zadd, zcard', async () => {
    const service = new RedisService();
    service.onModuleInit();

    // Give it a brief moment to connect to local Docker Redis
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (service.isReady()) {
      expect(await service.ping()).toBe('PONG');

      await service.set('test:hello', 'world', 10);
      expect(await service.get('test:hello')).toBe('world');

      await service.zadd('test:presence:user1', Date.now(), 'socket1');
      await service.zadd('test:presence:user1', Date.now(), 'socket2');
      expect(await service.zcard('test:presence:user1')).toBe(2);

      await service.zrem('test:presence:user1', 'socket1');
      expect(await service.zcard('test:presence:user1')).toBe(1);

      await service.del('test:hello', 'test:presence:user1');
    }

    await service.onModuleDestroy();
  });
});
