import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../realtime/redis.service.js';
import type { PresenceResponse, UserPresence } from './dto/presence.response.js';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly HEARTBEAT_TTL_MS = 60_000; // 60 seconds heartbeat expiry
  private readonly KEY_TTL_SECONDS = 120; // Key expires if all sockets stop heartbeating

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private presenceKey(userId: string): string {
    return `presence:${userId}`;
  }

  /**
   * Registers an active socket connection for a user.
   * Returns true if this is the user's first connection (transitioned from offline to online).
   */
  async addConnection(userId: string, socketId: string): Promise<boolean> {
    const key = this.presenceKey(userId);
    const now = Date.now();

    try {
      const initialCount = await this.redis.zcard(key);
      await this.redis.zadd(key, now, socketId);
      await this.redis.expire(key, this.KEY_TTL_SECONDS);

      return initialCount === 0;
    } catch (err: any) {
      this.logger.warn(`Failed to track presence for user ${userId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Unregisters a socket connection for a user.
   * Returns true if user has no remaining active connections (transitioned to offline).
   */
  async removeConnection(
    userId: string,
    socketId: string,
  ): Promise<{ wasLast: boolean; lastSeenAt: string }> {
    const key = this.presenceKey(userId);
    const lastSeenAt = new Date().toISOString();

    try {
      await this.redis.zrem(key, socketId);
      const remainingCount = await this.redis.zcard(key);

      if (remainingCount === 0) {
        // User transitioned to offline - persist lastSeenAt to database
        await this.prisma.user
          .update({
            where: { id: userId },
            data: { lastSeenAt: new Date(lastSeenAt) },
          })
          .catch((err) =>
            this.logger.warn(`Failed to update lastSeenAt for user ${userId}: ${err.message}`),
          );

        return { wasLast: true, lastSeenAt };
      }

      return { wasLast: false, lastSeenAt };
    } catch (err: any) {
      this.logger.warn(`Failed to remove presence socket for user ${userId}: ${err.message}`);
      return { wasLast: false, lastSeenAt };
    }
  }

  /**
   * Refreshes the heartbeat score for an active socket.
   */
  async heartbeat(userId: string, socketId: string): Promise<void> {
    const key = this.presenceKey(userId);
    const now = Date.now();

    try {
      await this.redis.zadd(key, now, socketId);
      await this.redis.expire(key, this.KEY_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`Presence heartbeat failed for user ${userId}: ${err.message}`);
    }
  }

  /**
   * Retrieves online presence and last seen timestamps for the requested user IDs.
   */
  async getPresence(
    userId: string,
    targetUserIds: string[],
  ): Promise<PresenceResponse> {
    const presence: Record<string, UserPresence> = {};
    if (!targetUserIds.length) {
      return { presence };
    }

    const uniqueIds = Array.from(new Set(targetUserIds));
    const now = Date.now();
    const threshold = now - this.HEARTBEAT_TTL_MS;
    const offlineIds: string[] = [];

    // Pipeline query to check presence in Redis in a single round-trip
    const pipeline = this.redis.pipeline();

    if (pipeline) {
      for (const id of uniqueIds) {
        const key = this.presenceKey(id);
        pipeline.zremrangebyscore(key, 0, threshold);
        pipeline.zcard(key);
      }

      try {
        const results = await pipeline.exec();
        // Results are pairs of [zremrangebyscore, zcard]
        if (results) {
          for (let i = 0; i < uniqueIds.length; i++) {
            const id = uniqueIds[i]!;
            const zcardResult = results[i * 2 + 1];
            const count = (zcardResult && zcardResult[1] ? Number(zcardResult[1]) : 0);

            if (count > 0 || id === userId) {
              presence[id] = {
                online: true,
                lastSeenAt: null,
              };
            } else {
              offlineIds.push(id);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Pipeline presence query failed: ${err.message}. Falling back.`);
      }
    }

    // Fallback if Redis was offline or pipeline had errors
    for (const id of uniqueIds) {
      if (!presence[id] && !offlineIds.includes(id)) {
        offlineIds.push(id);
      }
    }

    // For offline users, fetch real lastSeenAt from Postgres
    if (offlineIds.length > 0) {
      try {
        const users = await this.prisma.user.findMany({
          where: { id: { in: offlineIds } },
          select: { id: true, lastSeenAt: true },
        });

        const userMap = new Map(users.map((u) => [u.id, u.lastSeenAt]));

        for (const id of offlineIds) {
          const lastSeen = userMap.get(id);
          presence[id] = {
            online: false,
            lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fetch lastSeenAt from database: ${err.message}`);
        for (const id of offlineIds) {
          presence[id] = {
            online: false,
            lastSeenAt: null,
          };
        }
      }
    }

    return { presence };
  }
}
