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
import { resolveSocketUser, type SocketUser } from '../common/utils/socket-user.util.js';

export interface WsAckError {
  ok: false;
  code: string;
  message: string;
  error: string;
}

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
   * Connection hook - verifies authentication, rejects invalid sockets,
   * and scopes presence updates to user's rooms.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await resolveSocketUser(client);

      if (!user?.id) {
        this.logger.debug(`Rejecting unauthenticated connection: ${client.id}`);
        client.emit(WS_SERVER_EVENTS.ERROR, {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        client.disconnect(true);
        return;
      }

      client.data.user = user;
      const isFirst = await this.presenceService.addConnection(user.id, client.id);

      if (isFirst && this.server) {
        const userRooms = await this.prisma.roomMember.findMany({
          where: { userId: user.id },
          select: { roomId: true },
        });

        if (userRooms.length > 0) {
          const roomIds = userRooms.map((r) => r.roomId);
          this.server.to(roomIds).emit(WS_SERVER_EVENTS.PRESENCE_UPDATE, {
            userId: user.id,
            online: true,
            lastSeenAt: null,
          });
        }
      }

      this.logger.log(`Authenticated client connected: ${client.id} (user: ${user.id})`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Error during socket connection handshake: ${errMsg}`);
      client.emit(WS_SERVER_EVENTS.ERROR, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      client.disconnect(true);
    }
  }

  /**
   * Disconnection hook - removes presence and emits scoped offline updates to user rooms.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (userId) {
      const { wasLast, lastSeenAt } = await this.presenceService.removeConnection(
        userId,
        client.id,
      );

      if (wasLast && this.server) {
        const userRooms = await this.prisma.roomMember.findMany({
          where: { userId },
          select: { roomId: true },
        });

        if (userRooms.length > 0) {
          const roomIds = userRooms.map((r) => r.roomId);
          this.server.to(roomIds).emit(WS_SERVER_EVENTS.PRESENCE_UPDATE, {
            userId,
            online: false,
            lastSeenAt,
          });
        }
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
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (userId) {
      await this.presenceService.heartbeat(userId, client.id);
    }
    return { ok: true };
  }

  /**
   * Subscribes the socket to a room channel after verifying active membership.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOM_JOIN)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomWsDto,
  ): Promise<{ ok: true; roomId: string } | WsAckError> {
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        error: 'Authentication required',
      };
    }

    const membership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: payload.roomId,
          userId,
        },
      },
      select: { roomId: true },
    });

    if (!membership) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You are not a member of this room',
        error: 'You are not a member of this room',
      };
    }

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
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    await client.leave(payload.roomId);
    if (userId) {
      client.to(payload.roomId).emit(WS_SERVER_EVENTS.MEMBER_LEFT, {
        roomId: payload.roomId,
        userId,
      });
    }
    this.logger.log(`Client ${client.id} (user: ${userId ?? 'unknown'}) left room ${payload.roomId}`);
    return { ok: true, roomId: payload.roomId };
  }

  /**
   * Receives and broadcasts a new chat message cross-node via Redis.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_SEND)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageWsDto,
  ): Promise<{ ok: true; data: unknown } | WsAckError> {
    const user = (client.data as { user?: SocketUser })?.user;
    if (!user?.id) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        error: 'Unauthorized',
      };
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send message: ${errMsg}`);
      return {
        ok: false,
        code: 'SEND_FAILED',
        message: errMsg,
        error: errMsg,
      };
    }
  }

  /**
   * Updates read receipts and read cursors for a room member.
   * Requires socket to have joined the room.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadWsDto,
  ): Promise<{ ok: true } | WsAckError> {
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        error: 'Authentication required',
      };
    }

    if (!client.rooms.has(payload.roomId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before marking messages as read',
        error: 'You must join the room before marking messages as read',
      };
    }

    try {
      await this.prisma.roomMember.update({
        where: { roomId_userId: { roomId: payload.roomId, userId } },
        data: { lastReadMessageId: payload.messageId },
      });

      await this.prisma.messageReceipt.upsert({
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
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to persist message read receipt for message ${payload.messageId}: ${errMsg}`,
      );
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
   * Emits user typing indicator start.
   * Requires socket to have joined the room.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): Promise<{ ok: true } | WsAckError> {
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        error: 'Authentication required',
      };
    }

    if (!client.rooms.has(payload.roomId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before sending typing indicators',
        error: 'You must join the room before sending typing indicators',
      };
    }

    await this.typingService.setTyping(payload.roomId, userId);
    client.to(payload.roomId).emit(WS_SERVER_EVENTS.TYPING, {
      roomId: payload.roomId,
      userId,
      isTyping: true,
    });
    return { ok: true };
  }

  /**
   * Emits user typing indicator stop.
   * Requires socket to have joined the room.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): Promise<{ ok: true } | WsAckError> {
    const userId = (client.data as { user?: SocketUser })?.user?.id;
    if (!userId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        error: 'Authentication required',
      };
    }

    if (!client.rooms.has(payload.roomId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before sending typing indicators',
        error: 'You must join the room before sending typing indicators',
      };
    }

    await this.typingService.removeTyping(payload.roomId, userId);
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
  ): Promise<{ ok: true; rooms: unknown[] } | (WsAckError & { rooms: unknown[] })> {
    const user = (client.data as { user?: SocketUser })?.user;
    if (!user?.id) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        error: 'Unauthorized',
        rooms: [],
      };
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
