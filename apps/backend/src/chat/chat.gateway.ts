import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WS_CLIENT_EVENTS } from './chat.events.js';
import { JoinRoomWsDto } from './dto/ws/join-room.ws-dto.js';
import { LeaveRoomWsDto } from './dto/ws/leave-room.ws-dto.js';
import { SendMessageWsDto } from './dto/ws/send-message.ws-dto.js';
import { MarkReadWsDto } from './dto/ws/mark-read.ws-dto.js';
import { TypingWsDto } from './dto/ws/typing.ws-dto.js';
import { ResyncWsDto } from './dto/ws/resync.ws-dto.js';

export interface WsAckPlaceholder {
  ok: true;
  placeholder: true;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket'],
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  /**
   * Subscribes the socket to a room channel.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOM_JOIN)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Verify authenticated session on client.data and check room membership via prisma.
    // client.join(payload.roomId);
    this.logger.log(`Client ${client?.id} joined room ${payload.roomId}`);
    return { ok: true, placeholder: true };
  }

  /**
   * Unsubscribes the socket from a room channel.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOM_LEAVE)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): client.leave(payload.roomId);
    this.logger.log(`Client ${client?.id} left room ${payload.roomId}`);
    return { ok: true, placeholder: true };
  }

  /**
   * Receives and broadcasts a new chat message.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_SEND)
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Persist message via prisma, broadcast message:new via Redis pub/sub adapter.
    this.logger.log(
      `Client ${client?.id} sent message ${payload.clientMessageId} to room ${payload.roomId}`,
    );
    return { ok: true, placeholder: true };
  }

  /**
   * Updates read receipts and read cursors for a room member.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.MESSAGE_READ)
  handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Update prisma.roomMember.lastReadMessageId and broadcast message:read.
    this.logger.log(
      `Client ${client?.id} marked message ${payload.messageId} as read in room ${payload.roomId}`,
    );
    return { ok: true, placeholder: true };
  }

  /**
   * Emits user typing indicator start.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Broadcast typing event with isTyping: true to room socket channel.
    this.logger.log(`Client ${client?.id} started typing in room ${payload.roomId}`);
    return { ok: true, placeholder: true };
  }

  /**
   * Emits user typing indicator stop.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Broadcast typing event with isTyping: false to room socket channel.
    this.logger.log(`Client ${client?.id} stopped typing in room ${payload.roomId}`);
    return { ok: true, placeholder: true };
  }

  /**
   * Bulk reconnect resync for multiple rooms.
   */
  @SubscribeMessage(WS_CLIENT_EVENTS.ROOMS_RESYNC)
  handleResync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ResyncWsDto,
  ): WsAckPlaceholder {
    // TODO(impl): Fetch missed messages across requested rooms and return in ack.
    this.logger.log(
      `Client ${client?.id} requested resync for ${payload.rooms.length} rooms`,
    );
    return { ok: true, placeholder: true };
  }
}
