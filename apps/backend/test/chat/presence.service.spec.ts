import { describe, expect, it, vi } from 'vitest';
import { PresenceService } from '../../src/chat/presence.service.js';

describe('PresenceService', () => {
  const createMockRedis = () => {
    const store = new Map<string, Map<string, number>>();

    return {
      isReady: () => true,
      zcard: vi.fn(async (key: string) => store.get(key)?.size ?? 0),
      zadd: vi.fn(async (key: string, score: number, member: string) => {
        if (!store.has(key)) store.set(key, new Map());
        store.get(key)!.set(member, score);
        return 1;
      }),
      zrem: vi.fn(async (key: string, member: string) => {
        const set = store.get(key);
        if (!set) return 0;
        const deleted = set.delete(member);
        return deleted ? 1 : 0;
      }),
      expire: vi.fn(async () => 1),
      pipeline: vi.fn(() => ({
        zremrangebyscore: vi.fn(),
        zcard: vi.fn(),
        exec: vi.fn(async () => [
          [null, 0],
          [null, 1], // user1 online
          [null, 0],
          [null, 0], // user2 offline
        ]),
      })),
    } as any;
  };

  const createMockPrisma = () =>
    ({
      user: {
        update: vi.fn().mockResolvedValue({ id: 'u1' }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'user2', lastSeenAt: new Date('2026-01-01T12:00:00Z') },
        ]),
      },
    }) as any;

  it('correctly tracks first connection and last disconnection', async () => {
    const mockRedis = createMockRedis();
    const mockPrisma = createMockPrisma();
    const service = new PresenceService(mockRedis, mockPrisma);

    // First connection: initial count was 0 -> returns true
    const isFirst = await service.addConnection('user_123', 'socket_1');
    expect(isFirst).toBe(true);
    expect(mockRedis.zadd).toHaveBeenCalledWith('presence:user_123', expect.any(Number), 'socket_1');

    // Second connection from another tab: count is now 1 -> returns false
    const isSecond = await service.addConnection('user_123', 'socket_2');
    expect(isSecond).toBe(false);

    // Remove first socket: remaining count is 1 -> wasLast is false
    const res1 = await service.removeConnection('user_123', 'socket_1');
    expect(res1.wasLast).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();

    // Remove last socket: remaining count is 0 -> wasLast is true, persists to prisma
    const res2 = await service.removeConnection('user_123', 'socket_2');
    expect(res2.wasLast).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('retrieves presence statuses across active and offline users', async () => {
    const mockRedis = createMockRedis();
    const mockPrisma = createMockPrisma();
    const service = new PresenceService(mockRedis, mockPrisma);

    const result = await service.getPresence('user1', ['user1', 'user2']);

    expect(result.presence['user1']).toBeDefined();
    expect(result.presence['user1']!.online).toBe(true);

    expect(result.presence['user2']).toBeDefined();
    expect(result.presence['user2']!.online).toBe(false);
    expect(result.presence['user2']!.lastSeenAt).toBe('2026-01-01T12:00:00.000Z');
  });
});
