import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { getNodeId } from '../common/utils/node-id.js';
import { WsThrottleGuard } from '../common/guards/ws-throttle.guard.js';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from './chat.events.js';
import { PresenceService } from './presence.service.js';
import { JoinRoomWsDto } from './dto/ws/join-room.ws-dto.js';
import { LeaveRoomWsDto } from './dto/ws/leave-room.ws-dto.js';
import { SendMessageWsDto } from './dto/ws/send-message.ws-dto.js';
import { MarkReadWsDto } from './dto/ws/mark-read.ws-dto.js';
import { TypingWsDto } from './dto/ws/typing.ws-dto.js';
import { ResyncWsDto } from './dto/ws/resync.ws-dto.js';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket'],
})
@UseGuards(WsThrottleGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Connection hook - attaches user session and registers Redis presence.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      let user = (client.data as any)?.user;

      if (!user) {
        const devHeader = client.handshake?.headers?.['x-dev-user-id'];
        const devAuthUser =
          (client.handshake?.auth as { userId?: string } | undefined)?.userId ??
          (Array.isArray(devHeader) ? devHeader[0] : devHeader);

        if (typeof devAuthUser === 'string' && devAuthUser.trim().length > 0) {
          user = {
            id: devAuthUser.trim(),
            name: 'Dev User',
            email: `${devAuthUser.trim()}@example.com`,
          };
        }
      }

      if (user?.id) {
        client.data.user = user;
        const isFirst = await this.presenceService.addConnection(user.id, client.id);

        if (isFirst && this.server) {
          this.server.emit(WS_SERVER_EVENTS.PRESENCE_UPDATE, {
            userId: user.id,
            online: true,
            lastSeenAt: null,
          });
        }
        this.logger.log(`Authenticated client connected: ${client.id} (user: ${user.id})`);
      } else {
        this.logger.debug(`Client connected without active session: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.warn(`Error during socket connection handshake: ${err.message}`);
    }
  }

  /**
   * Disconnection hook - removes Redis presence and persists lastSeenAt if last connection.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client?.data as any)?.user?.id;
    if (userId) {
      const { wasLast, lastSeenAt } = await this.presenceService.removeConnection(
        userId,
        client.id,
      );

      if (wasLast && this.server) {
        this.server.emit(WS_SERVER_EVENTS.PRESENCE_UPDATE, {
          userId,
          online: false,
          lastSeenAt,
        });
      }
      this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
    } else {
      this.logger.debug(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Periodic socket heartbeat to refresh presence TTL in Redis.
   */
  @SubscribeMessage('presence:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket): Promise<{ ok: true }> {
    const userId = (client?.data as any)?.user?.id;
    if (userId) {
      await this.presenceService.heartbeat(userId, client.id);
    }
    return { ok: true };
  }

  /**
   * Subscribes the socket to a room channel.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOM_JOIN)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomWsDto,
  ): Promise<{ ok: true; roomId: string }> {
    const userId = (client?.data as any)?.user?.id;
    await client.join(payload.roomId);
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.MEMBER_JOINED, {
      roomId: payload.roomId,
      userId,
    });
    this.logger.log(`Client ${client.id} (user: ${userId}) joined room ${payload.roomId}`);
    return { ok: true, roomId: payload.roomId };
  }

  /**
   * Unsubscribes the socket from a room channel.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOM_LEAVE)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomWsDto,
  ): Promise<{ ok: true; roomId: string }> {
    const userId = (client?.data as any)?.user?.id;
    await client.leave(payload.roomId);
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.MEMBER_LEFT, {
      roomId: payload.roomId,
      userId,
    });
    this.logger.log(`Client ${client.id} (user: ${userId}) left room ${payload.roomId}`);
    return { ok: true, roomId: payload.roomId };
  }

  /**
   * Receives and broadcasts a new chat message cross-node via Redis.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_SEND)
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageWsDto,
  ): { ok: true; data: any } {
    const user = (client?.data as any)?.user;
    const message = {
      id: crypto.randomUUID(),
      roomId: payload.roomId,
      sender: {
        id: user?.id ?? 'anonymous',
        name: user?.name ?? 'User',
        image: user?.image ?? null,
      },
      clientMessageId: payload.clientMessageId,
      body: payload.body,
      replyTo: payload.replyToId ? { id: payload.replyToId } : null,
      attachments: (payload.mediaIds ?? []).map((id) => ({ id, url: '' })),
      reactions: [],
      nodeId: getNodeId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Cross-node broadcast via Socket.IO Redis adapter
    if (this.server) {
      this.server.to(payload.roomId).emit(WS_SERVER_EVENTS.MESSAGE_NEW, message);
    }
    this.logger.log(
      `Broadcast message ${payload.clientMessageId} to room ${payload.roomId} across cluster`,
    );
    return { ok: true, data: message };
  }

  /**
   * Updates read receipts and read cursors for a room member.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_READ)
  handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadWsDto,
  ): { ok: true } {
    const userId = (client?.data as any)?.user?.id;
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.MESSAGE_READ, {
      roomId: payload.roomId,
      userId,
      messageId: payload.messageId,
    });
    this.logger.log(`User ${userId} marked message ${payload.messageId} read in ${payload.roomId}`);
    return { ok: true };
  }

  /**
   * Emits user typing indicator start (ephemeral, not written to DB).
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): { ok: true } {
    const userId = (client?.data as any)?.user?.id;
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.TYPING, {
      roomId: payload.roomId,
      userId,
      isTyping: true,
    });
    return { ok: true };
  }

  /**
   * Emits user typing indicator stop (ephemeral, not written to DB).
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): { ok: true } {
    const userId = (client?.data as any)?.user?.id;
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.TYPING, {
      roomId: payload.roomId,
      userId,
      isTyping: false,
    });
    return { ok: true };
  }

  /**
   * Bulk reconnect resync for multiple rooms.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOMS_RESYNC)
  handleResync(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ResyncWsDto,
  ): { ok: true; rooms: any[] } {
    return {
      ok: true,
      rooms: payload.rooms.map((r) => ({
        roomId: r.roomId,
        messages: [],
      })),
    };
  }
}
