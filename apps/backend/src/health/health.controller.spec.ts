import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../realtime/redis.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: Partial<PrismaService>;
  let mockRedis: Partial<RedisService>;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    };
    controller = new HealthController(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
    );
  });

  it('getLive returns status ok', () => {
    const res = controller.getLive();
    expect(res).toEqual({ status: 'ok' });
  });

  it('getReady returns status ok when database and redis are up', async () => {
    const res = await controller.getReady();
    expect(res).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('getReady throws ServiceUnavailableException when database is down', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn().mockRejectedValue(new Error('DB down'));

    await expect(controller.getReady()).rejects.toThrow(
      ServiceUnavailableException,
    );

    try {
      await controller.getReady();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const res = (err as ServiceUnavailableException).getResponse();
      expect(res).toEqual({
        status: 'degraded',
        checks: { database: 'down', redis: 'up' },
      });
    }
  });

  it('getReady throws ServiceUnavailableException when redis is down', async () => {
    mockRedis.ping = vi.fn().mockRejectedValue(new Error('Redis down'));

    await expect(controller.getReady()).rejects.toThrow(
      ServiceUnavailableException,
    );

    try {
      await controller.getReady();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const res = (err as ServiceUnavailableException).getResponse();
      expect(res).toEqual({
        status: 'degraded',
        checks: { database: 'up', redis: 'down' },
      });
    }
  });

  it('getNode returns nodeId, uptimeSeconds and timestamp', () => {
    const res = controller.getNode();
    expect(res.nodeId).toBeDefined();
    expect(typeof res.uptimeSeconds).toBe('number');
    expect(res.timestamp).toBeDefined();
  });
});
