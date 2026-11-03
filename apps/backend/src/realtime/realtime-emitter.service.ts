import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Lets REST services broadcast Socket.IO events without depending on `ChatGateway`
 * (which would create a module cycle: ChatModule -> MessagesModule -> ChatModule).
 *
 * `ChatGateway.afterInit` hands the Socket.IO server to `attach()`. Emitting through the
 * server uses the Redis adapter, so events reach room members on every API node.
 *
 * Broadcasting is best-effort: a failure is logged and never fails the REST request.
 */
@Injectable()
export class RealtimeEmitter {
  private readonly logger = new Logger(RealtimeEmitter.name);
  private server: Server | null = null;

  /** Called once by the gateway when the Socket.IO server is ready. */
  attach(server: Server): void {
    this.server = server;
  }

  /** Emits `event` to every socket subscribed to the room channel (all nodes). */
  toRoom(roomId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(`No socket server attached; dropped "${event}" for room ${roomId}`);
      return;
    }
    try {
      this.server.to(roomId).emit(event, payload);
    } catch (err: unknown) {
      this.logger.warn(`Failed to emit "${event}" to room ${roomId}: ${errorMessage(err)}`);
    }
  }

  /**
   * Unsubscribes every live socket of `userId` (on any node) from the room channel, so a
   * removed member stops receiving room broadcasts until they reconnect or re-join.
   */
  async evictUser(roomId: string, userId: string): Promise<void> {
    if (!this.server) return;
    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      for (const socket of sockets) {
        if ((socket.data as { user?: { id?: string } } | undefined)?.user?.id === userId) {
          socket.leave(roomId);
        }
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to evict user ${userId} from room ${roomId}: ${errorMessage(err)}`,
      );
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const NEUTRAL_PREFERENCE = { isMuted: false, isArchived: false, isPinned: false };

/**
 * Broadcast payloads go to the whole room, so fields that are relative to the acting
 * user must not leak to everyone else. Reaction summaries keep `userIds`; clients
 * recompute `hasReacted` from them.
 */
export function neutralizeReactionViewer<T extends { reactions: unknown[] }>(message: T): T {
  return {
    ...message,
    reactions: message.reactions.map((r) => {
      const reaction = { ...(r as Record<string, unknown>) };
      if ('hasReacted' in reaction) reaction.hasReacted = false;
      if ('reactedByMe' in reaction) reaction.reactedByMe = false;
      return reaction;
    }),
  };
}

/**
 * Strips the acting user's personal state (unread count, mute/archive/pin, own role)
 * from a room detail before broadcasting it as `room:updated`.
 */
export function neutralizeRoomViewer<T extends { unreadCount: number }>(room: T): T {
  const out: Record<string, unknown> = { ...room, unreadCount: 0 };
  if ('preference' in out) out.preference = { ...NEUTRAL_PREFERENCE };
  if ('preferences' in out) out.preferences = { ...NEUTRAL_PREFERENCE };
  delete out.myRole;
  return out as T;
}
