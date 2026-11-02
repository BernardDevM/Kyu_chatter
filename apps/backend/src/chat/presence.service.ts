import { Injectable } from '@nestjs/common';
import type { PresenceResponse, UserPresence } from './dto/presence.response.js';

@Injectable()
export class PresenceService {
  /**
   * Retrieves online presence and last seen timestamps for the requested user IDs.
   */
  async getPresence(
    userId: string,
    targetUserIds: string[],
  ): Promise<PresenceResponse> {
    // TODO(impl): Read active socket connections from Redis presence keys (e.g. `presence:${targetId}`)
    // For offline users, batch-fetch lastSeenAt from prisma.user.findMany({ where: { id: { in: targetUserIds } }, select: { id: true, lastSeenAt: true } })
    const presence: Record<string, UserPresence> = {};
    for (const id of targetUserIds) {
      presence[id] = {
        online: id === userId || id.endsWith('1'),
        lastSeenAt: new Date().toISOString(),
      };
    }

    return { presence };
  }
}
