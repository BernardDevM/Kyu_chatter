import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { RedisService } from '../../realtime/redis.service.js';
import type { SocketUser } from '../utils/socket-user.util.js';

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
    const userId = (client?.data as { user?: SocketUser } | undefined)?.user?.id;
    const identifier = userId ? `user:${userId}` : `socket:${client?.id ?? 'unknown'}`;
    const key = `ratelimit:ws:${identifier}`;

    // Redis-backed rate limiter with atomic SET NX and INCR pipeline
    try {
      if (this.redis?.isReady()) {
        const pipe = this.redis.pipeline();
        if (pipe) {
          pipe.set(key, '0', 'EX', this.windowSeconds, 'NX');
          pipe.incr(key);
          const results = await pipe.exec();

          if (results && results[1] && !results[1][0]) {
            const count = Number(results[1][1]);
            if (count > this.limit) {
              throw new WsException('Rate limit exceeded: Too many messages, please slow down.');
            }
            return true;
          }
        } else {
          // Fallback if pipeline unavailable
          const count = await this.redis.incr(key);
          if (count === 1) {
            await this.redis.expire(key, this.windowSeconds);
          }
          if (count > this.limit) {
            throw new WsException('Rate limit exceeded: Too many messages, please slow down.');
          }
          return true;
        }
      }
    } catch (err: unknown) {
      if (err instanceof WsException) throw err;
      // Fallback to in-memory on unexpected Redis error
    }

    // In-memory fallback with per-access pruning
    const now = Date.now();
    for (const [id, rec] of this.clients.entries()) {
      if (now > rec.resetAt) {
        this.clients.delete(id);
      }
    }

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
