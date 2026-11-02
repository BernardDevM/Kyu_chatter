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
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { WsAuthGuard } from '../common/guards/ws-auth.guard.js';
import { WsThrottleGuard } from '../common/guards/ws-throttle.guard.js';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from './chat.events.js';
import { PresenceService } from './presence.service.js';
import { TypingService } from './typing.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptStatus } from '../generated/prisma/enums.js';
import { JoinRoomWsDto } from './dto/ws/join-room.ws-dto.js';
import { LeaveRoomWsDto } from './dto/ws/leave-room.ws-dto.js';
import { SendMessageWsDto } from './dto/ws/send-message.ws-dto.js';
import { MarkReadWsDto } from './dto/ws/mark-read.ws-dto.js';
import { TypingWsDto } from './dto/ws/typing.ws-dto.js';
import { ResyncWsDto } from './dto/ws/resync.ws-dto.js';
import { corsOriginCallback } from '../common/utils/cors.util.js';

@WebSocketGateway({
  cors: {
    origin: corsOriginCallback,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseGuards(WsAuthGuard, WsThrottleGuard)
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

  constructor(
    private readonly presenceService: PresenceService,
    private readonly typingService: TypingService,
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Connection hook - attaches user session and registers Redis presence.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      let user = (client.data as any)?.user;

      if (!user) {
        try {
          const headers = fromNodeHeaders(client.handshake?.headers || {});
          const session = await auth.api.getSession({ headers });
          if (session?.user) {
            user = session.user;
          }
        } catch {
          // Continue to dev fallback
        }
      }

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
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageWsDto,
  ): Promise<{ ok: boolean; data?: any; error?: string }> {
    const user = (client?.data as any)?.user;
    if (!user?.id) {
      return { ok: false, error: 'Unauthorized' };
    }

    try {
      const message = await this.messagesService.sendMessage(
        user.id,
        payload.roomId,
        payload,
      );

      // Cross-node broadcast via Socket.IO Redis adapter
      if (this.server) {
        this.server.to(payload.roomId).emit(WS_SERVER_EVENTS.MESSAGE_NEW, message);
      }
      this.logger.log(
        `Broadcast message ${payload.clientMessageId} to room ${payload.roomId} across cluster`,
      );
      return { ok: true, data: message };
    } catch (err: any) {
      this.logger.warn(`Failed to send message: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Updates read receipts and read cursors for a room member.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadWsDto,
  ): Promise<{ ok: boolean }> {
    const userId = (client?.data as any)?.user?.id;
    if (userId) {
      await this.prisma.roomMember
        .update({
          where: { roomId_userId: { roomId: payload.roomId, userId } },
          data: { lastReadMessageId: payload.messageId },
        })
        .catch(() => {});

      await this.prisma.messageReceipt
        .upsert({
          where: {
            messageId_userId: {
              messageId: payload.messageId,
              userId,
            },
          },
          update: {
            status: ReceiptStatus.READ,
            readAt: new Date(),
          },
          create: {
            messageId: payload.messageId,
            userId,
            status: ReceiptStatus.READ,
            readAt: new Date(),
          },
        })
        .catch(() => {});
    }

    client.to(payload.roomId).emit(WS_SERVER_EVENTS.MESSAGE_READ, {
      roomId: payload.roomId,
      userId,
      messageId: payload.messageId,
    });
    this.logger.log(
      `User ${userId} marked message ${payload.messageId} read in ${payload.roomId}`,
    );
    return { ok: true };
  }

  /**
   * Emits user typing indicator start (ephemeral, not written to DB).
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): Promise<{ ok: true }> {
    const userId = (client?.data as any)?.user?.id;
    if (userId) {
      await this.typingService.setTyping(payload.roomId, userId);
    }
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
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): Promise<{ ok: true }> {
    const userId = (client?.data as any)?.user?.id;
    if (userId) {
      await this.typingService.removeTyping(payload.roomId, userId);
    }
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
  async handleResync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ResyncWsDto,
  ): Promise<{ ok: boolean; rooms: any[] }> {
    const user = (client?.data as any)?.user;
    if (!user?.id) {
      return { ok: false, rooms: [] };
    }

    const rooms = await Promise.all(
      payload.rooms.map(async (r) => {
        try {
          if (r.lastSeenMessageId) {
            const messages = await this.messagesService.syncMessages(
              user.id,
              r.roomId,
              { afterId: r.lastSeenMessageId },
            );
            return { roomId: r.roomId, messages };
          }
          const page = await this.messagesService.listMessages(
            user.id,
            r.roomId,
            { limit: 30 },
          );
          return { roomId: r.roomId, messages: page.items };
        } catch {
          return { roomId: r.roomId, messages: [] };
        }
      }),
    );

    return {
      ok: true,
      rooms,
    };
  }
}
