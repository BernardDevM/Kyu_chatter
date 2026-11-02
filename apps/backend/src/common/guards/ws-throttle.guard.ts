import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { RedisService } from '../../realtime/redis.service.js';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class WsThrottleGuard implements CanActivate {
  private readonly clients = new Map<string, RateLimitRecord>();
  private readonly limit = 30; // Max events per window
  private readonly windowSeconds = 5; // 5 seconds window

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const userId = (client?.data as any)?.user?.id;
    const identifier = userId ? `user:${userId}` : `socket:${client?.id ?? 'unknown'}`;
    const key = `ratelimit:ws:${identifier}`;

    // Redis-backed rate limiter
    try {
      if (this.redis.isReady()) {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, this.windowSeconds);
        }
        if (count > this.limit) {
          throw new WsException('Rate limit exceeded: Too many messages, please slow down.');
        }
        return true;
      }
    } catch (err: any) {
      if (err instanceof WsException) throw err;
      // Fallback to in-memory on unexpected Redis error
    }

    // In-memory fallback
    const now = Date.now();
    const record = this.clients.get(identifier);
    if (!record || now > record.resetAt) {
      this.clients.set(identifier, { count: 1, resetAt: now + this.windowSeconds * 1000 });
      return true;
    }

    record.count += 1;
    if (record.count > this.limit) {
      throw new WsException('Rate limit exceeded: Too many messages, please slow down.');
    }

    return true;
  }
}
