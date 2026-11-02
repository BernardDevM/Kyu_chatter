import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../realtime/redis.service.js';

@Injectable()
export class TypingService {
  private readonly logger = new Logger(TypingService.name);
  private readonly TYPING_TTL_SECONDS = 5;

  constructor(private readonly redis: RedisService) {}

  private typingKey(roomId: string): string {
    return `typing:${roomId}`;
  }

  /**
   * Records a user as actively typing in a room with an auto-expiring TTL.
   */
  async setTyping(roomId: string, userId: string): Promise<void> {
    try {
      const key = this.typingKey(roomId);
      await this.redis.getClient()?.sadd(key, userId);
      await this.redis.expire(key, this.TYPING_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(
        `Failed to set typing state for user ${userId} in ${roomId}: ${err.message}`,
      );
    }
  }

  /**
   * Removes a user from typing state in a room.
   */
  async removeTyping(roomId: string, userId: string): Promise<void> {
    try {
      const key = this.typingKey(roomId);
      await this.redis.getClient()?.srem(key, userId);
    } catch (err: any) {
      this.logger.warn(
        `Failed to remove typing state for user ${userId} in ${roomId}: ${err.message}`,
      );
    }
  }

  /**
   * Returns list of currently typing user IDs in a room.
   */
  async getTypingUsers(roomId: string): Promise<string[]> {
    try {
      const key = this.typingKey(roomId);
      const members = await this.redis.getClient()?.smembers(key);
      return members ?? [];
    } catch (err: any) {
      this.logger.warn(
        `Failed to get typing users for room ${roomId}: ${err.message}`,
      );
      return [];
    }
  }
}
