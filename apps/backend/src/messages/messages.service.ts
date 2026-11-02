import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getNodeId } from '../common/utils/node-id.js';
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

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resynchronizes missed messages in chronological order (oldest first) after client reconnection.
   */
  async syncMessages(
    userId: string,
    roomId: string,
    query: SyncMessagesQueryDto,
  ): Promise<MessageResponse[]> {
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

    const limit = query.limit ?? 100;
    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        createdAt: { gt: anchor.createdAt },
      },
      take: limit,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        sender: { select: { id: true, name: true, image: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            sender: { select: { name: true } },
          },
        },
        attachments: {
          include: {
            media: true,
          },
        },
        reactions: true,
      },
    });

    return messages.map((m) => this.mapMessageToResponse(m, userId));
  }

  /**
   * Retrieves message history for a room, newest first with cursor pagination.
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
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        sender: { select: { id: true, name: true, image: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            sender: { select: { name: true } },
          },
        },
        attachments: {
          include: {
            media: true,
          },
        },
        reactions: true,
      },
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
      include: {
        sender: { select: { id: true, name: true, image: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            sender: { select: { name: true } },
          },
        },
        attachments: {
          include: {
            media: true,
          },
        },
        reactions: true,
      },
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
      include: {
        sender: { select: { id: true, name: true, image: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            sender: { select: { name: true } },
          },
        },
        attachments: {
          include: {
            media: true,
          },
        },
        reactions: true,
      },
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
      include: {
        sender: { select: { id: true, name: true, image: true } },
        replyTo: {
          select: {
            id: true,
            body: true,
            sender: { select: { name: true } },
          },
        },
        attachments: {
          include: {
            media: true,
          },
        },
        reactions: true,
      },
    });

    return this.mapMessageToResponse(updated, userId);
  }

  /**
   * Soft-deletes a message sent by the caller.
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        body: null,
      },
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

    return this.aggregateReactions(messageId, userId);
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

    return this.aggregateReactions(messageId, userId);
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
        userId: true,
        status: true,
        deliveredAt: true,
        readAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return receipts.map((r) => ({
      userId: r.userId,
      status: r.status,
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      readAt: r.readAt ? r.readAt.toISOString() : null,
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
    });

    const summaryMap = new Map<
      string,
      { count: number; reactedByMe: boolean }
    >();
    for (const r of reactions) {
      const existing = summaryMap.get(r.emoji) ?? {
        count: 0,
        reactedByMe: false,
      };
      existing.count += 1;
      if (r.userId === currentUserId) {
        existing.reactedByMe = true;
      }
      summaryMap.set(r.emoji, existing);
    }

    return Array.from(summaryMap.entries()).map(([emoji, val]) => ({
      emoji,
      count: val.count,
      reactedByMe: val.reactedByMe,
    }));
  }

  private mapMessageToResponse(
    msg: any,
    currentUserId: string,
  ): MessageResponse {
    const reactionMap = new Map<
      string,
      { count: number; reactedByMe: boolean; userIds: string[] }
    >();
    for (const r of msg.reactions ?? []) {
      const existing = reactionMap.get(r.emoji) ?? {
        count: 0,
        reactedByMe: false,
        userIds: [],
      };
      existing.count += 1;
      existing.userIds.push(r.userId);
      if (r.userId === currentUserId) {
        existing.reactedByMe = true;
      }
      reactionMap.set(r.emoji, existing);
    }
    const reactions = Array.from(reactionMap.entries()).map(([emoji, val]) => ({
      emoji,
      count: val.count,
      reactedByMe: val.reactedByMe,
      hasReacted: val.reactedByMe,
      userIds: val.userIds,
    }));

    return {
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId ?? msg.sender?.id,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        image: msg.sender.image,
      },
      clientMessageId: msg.clientMessageId,
      body: msg.body,
      replyToId: msg.replyToId ?? (msg.replyTo ? msg.replyTo.id : null),
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            body: msg.replyTo.body,
            senderName: msg.replyTo.sender?.name ?? 'Unknown',
          }
        : null,
      attachments: (msg.attachments ?? []).map((att: any) => ({
        id: att.id,
        media: {
          id: att.media.id,
          kind: att.media.kind,
          status: att.media.status,
          url: att.media.url,
          originalName: att.media.originalName,
          mimeType: att.media.mimeType,
          bytes: Number(att.media.bytes),
          width: att.media.width,
          height: att.media.height,
          duration: att.media.duration,
          createdAt: att.media.createdAt.toISOString(),
        },
      })),
      reactions,
      nodeId: msg.nodeId,
      createdAt: msg.createdAt.toISOString(),
      editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
      deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : null,
    };
  }
}
