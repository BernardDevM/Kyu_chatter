import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { MemberRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getNodeId } from '../common/utils/node-id.js';
import { toMediaResponse } from '../media/media.mapper.js';
import type {
  MessagePageResponse,
  MessageResponse,
  ReactionSummaryResponse,
  ReceiptResponse,
} from './dto/message.response.js';
import type { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';
import type { SyncMessagesQueryDto } from './dto/sync-messages-query.dto.js';
import type { SendMessageDto } from './dto/send-message.dto.js';
import type { EditMessageDto } from './dto/edit-message.dto.js';
import type { AddReactionDto } from './dto/add-reaction.dto.js';
import type { RemoveReactionQueryDto } from './dto/remove-reaction-query.dto.js';
import { WS_SERVER_EVENTS } from '../chat/chat.events.js';
import {
  neutralizeReactionViewer,
  RealtimeEmitter,
} from '../realtime/realtime-emitter.service.js';

/** Relations loaded for every message so it can be mapped to `MessageResponse`. */
const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, image: true } },
  attachments: { include: { media: true } },
  reactions: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtime?: RealtimeEmitter,
  ) {}

  /**
   * Resynchronizes missed messages in chronological order (oldest first) after client reconnection.
   * When `hasMore` is true, `nextCursor` is the id to pass as `afterId` for the next page.
   */
  async syncMessages(
    userId: string,
    roomId: string,
    query: SyncMessagesQueryDto,
  ): Promise<MessagePageResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const anchor = await this.prisma.message.findUnique({
      where: { id: query.afterId },
      select: { id: true, roomId: true, createdAt: true },
    });
    if (!anchor || anchor.roomId !== roomId) {
      throw new NotFoundException(
        `Anchor message with ID ${query.afterId} not found in this room`,
      );
    }

    const limit = query.limit ?? 50;
    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        createdAt: { gt: anchor.createdAt },
      },
      take: limit + 1,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: MESSAGE_INCLUDE,
    });

    const hasMore = messages.length > limit;
    const items = (hasMore ? messages.slice(0, limit) : messages).map((m) =>
      this.mapMessageToResponse(m, userId),
    );

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  /**
   * Retrieves message history for a room with cursor pagination.
   * `direction=before` (default) pages towards older messages, newest first;
   * `direction=after` pages towards newer messages, oldest first.
   */
  async listMessages(
    userId: string,
    roomId: string,
    query: ListMessagesQueryDto,
  ): Promise<MessagePageResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const limit = query.limit ?? 30;
    const order = query.direction === 'after' ? 'asc' : 'desc';
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy: [{ createdAt: order }, { id: order }],
      include: MESSAGE_INCLUDE,
    });

    const hasMore = messages.length > limit;
    const pageMessages = hasMore ? messages.slice(0, limit) : messages;
    const items = pageMessages.map((m) => this.mapMessageToResponse(m, userId));
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Sends a message into a room (REST fallback to WebSocket delivery).
   */
  async sendMessage(
    userId: string,
    roomId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Idempotent duplicate check
    const existing = await this.prisma.message.findUnique({
      where: {
        roomId_senderId_clientMessageId: {
          roomId,
          senderId: userId,
          clientMessageId: dto.clientMessageId,
        },
      },
      include: MESSAGE_INCLUDE,
    });
    if (existing) {
      return this.mapMessageToResponse(existing, userId);
    }

    if (dto.replyToId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
        select: { id: true, roomId: true },
      });
      if (!parent || parent.roomId !== roomId) {
        throw new BadRequestException(
          'Parent reply message does not exist in this room',
        );
      }
    }

    if (dto.mediaIds && dto.mediaIds.length > 0) {
      const mediaCount = await this.prisma.media.count({
        where: { id: { in: dto.mediaIds } },
      });
      if (mediaCount !== dto.mediaIds.length) {
        throw new BadRequestException('One or more media attachments not found');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        clientMessageId: dto.clientMessageId,
        body: dto.body ?? null,
        replyToId: dto.replyToId ?? null,
        nodeId: getNodeId(),
        attachments: dto.mediaIds?.length
          ? {
              create: dto.mediaIds.map((mediaId) => ({ mediaId })),
            }
          : undefined,
      },
      include: MESSAGE_INCLUDE,
    });

    await this.prisma.room.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return this.mapMessageToResponse(message, userId);
  }

  /**
   * Edits an existing message sent by the caller.
   */
  async editMessage(
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<MessageResponse> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.deletedAt !== null) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        body: dto.body,
        editedAt: new Date(),
      },
      include: MESSAGE_INCLUDE,
    });

    const response = this.mapMessageToResponse(updated, userId);
    this.realtime?.toRoom(
      response.roomId,
      WS_SERVER_EVENTS.MESSAGE_UPDATED,
      neutralizeReactionViewer(response),
    );
    return response;
  }

  /**
   * Soft-deletes a message. Allowed for the author or a room ADMIN/OWNER.
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true, senderId: true },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.senderId !== userId) {
      const member = await this.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: message.roomId, userId } },
        select: { role: true },
      });
      const isModerator =
        member?.role === MemberRole.OWNER || member?.role === MemberRole.ADMIN;
      if (!isModerator) {
        throw new ForbiddenException(
          'Only the author or a room admin can delete this message',
        );
      }
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        body: null,
      },
    });

    this.realtime?.toRoom(message.roomId, WS_SERVER_EVENTS.MESSAGE_DELETED, {
      messageId,
      roomId: message.roomId,
    });
  }

  /**
   * Adds an emoji reaction to a message.
   */
  async addReaction(
    userId: string,
    messageId: string,
    dto: AddReactionDto,
  ): Promise<ReactionSummaryResponse[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: message.roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
      },
      update: {},
      create: {
        messageId,
        userId,
        emoji: dto.emoji,
      },
    });

    const reactions = await this.aggregateReactions(messageId, userId);
    // Room-wide payload: `hasReacted` is per-viewer, so clients derive it from `userIds`.
    this.realtime?.toRoom(message.roomId, WS_SERVER_EVENTS.REACTION_UPDATED, {
      messageId,
      reactions: neutralizeReactionViewer({ reactions }).reactions,
    });
    return reactions;
  }

  /**
   * Removes a previously added emoji reaction.
   */
  async removeReaction(
    userId: string,
    messageId: string,
    query: RemoveReactionQueryDto,
  ): Promise<ReactionSummaryResponse[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: message.roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    await this.prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId,
        emoji: query.emoji,
      },
    });

    const reactions = await this.aggregateReactions(messageId, userId);
    // Room-wide payload: `hasReacted` is per-viewer, so clients derive it from `userIds`.
    this.realtime?.toRoom(message.roomId, WS_SERVER_EVENTS.REACTION_UPDATED, {
      messageId,
      reactions: neutralizeReactionViewer({ reactions }).reactions,
    });
    return reactions;
  }

  /**
   * Retrieves delivery and read receipts for a specific message.
   */
  async getReceipts(
    userId: string,
    messageId: string,
  ): Promise<ReceiptResponse[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: message.roomId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const receipts = await this.prisma.messageReceipt.findMany({
      where: { messageId },
      select: {
        messageId: true,
        userId: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return receipts.map((r) => ({
      messageId: r.messageId,
      userId: r.userId,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async aggregateReactions(
    messageId: string,
    currentUserId: string,
  ): Promise<ReactionSummaryResponse[]> {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });
    return summarizeReactions(reactions, currentUserId);
  }

  private mapMessageToResponse(
    msg: any,
    currentUserId: string,
  ): MessageResponse {
    return {
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId ?? msg.sender?.id,
      clientMessageId: msg.clientMessageId,
      body: msg.body,
      replyToId: msg.replyToId ?? null,
      nodeId: msg.nodeId,
      createdAt: msg.createdAt.toISOString(),
      editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
      deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : null,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        image: msg.sender.image,
      },
      attachments: (msg.attachments ?? []).map((att: any) =>
        toMediaResponse(att.media),
      ),
      reactions: summarizeReactions(msg.reactions ?? [], currentUserId),
    };
  }
}

/**
 * Groups raw reaction rows by emoji into the public summary shape, in
 * first-reacted order. `hasReacted` is computed for `currentUserId`.
 */
export function summarizeReactions(
  reactions: ReadonlyArray<{ emoji: string; userId: string }>,
  currentUserId: string,
): ReactionSummaryResponse[] {
  const byEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const userIds = byEmoji.get(r.emoji) ?? [];
    userIds.push(r.userId);
    byEmoji.set(r.emoji, userIds);
  }
  return Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    hasReacted: userIds.includes(currentUserId),
    userIds,
  }));
}
