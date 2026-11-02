import { Injectable } from '@nestjs/common';
import { ReceiptStatus } from '../generated/prisma/enums.js';
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
  /**
   * Resynchronizes missed messages in chronological order (oldest first) after client reconnection.
   */
  async syncMessages(
    userId: string,
    roomId: string,
    _query: SyncMessagesQueryDto,
  ): Promise<MessageResponse[]> {
    // TODO(impl): Verify caller membership in room.
    // Locate anchor message: prisma.message.findUniqueOrThrow({ where: { id: _query.afterId } })
    // Retrieve newer messages: prisma.message.findMany({
    //   where: { roomId, createdAt: { gt: anchor.createdAt } },
    //   take: _query.limit ?? 100,
    //   orderBy: { createdAt: 'asc' },
    //   include: { sender: true, attachments: { include: { media: true } }, reactions: true }
    // })
    return [
      {
        id: '018f3a5a-8b9a-7c2d-9e1f-444444444444',
        roomId,
        sender: {
          id: userId,
          name: 'Current User',
          image: null,
        },
        clientMessageId: '018f3a5a-8b9a-7c2d-9e1f-555555555555',
        body: 'Resynced message content',
        replyTo: null,
        attachments: [],
        reactions: [],
        nodeId: getNodeId(),
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
      },
    ];
  }

  /**
   * Retrieves message history for a room, newest first with cursor pagination.
   */
  async listMessages(
    userId: string,
    roomId: string,
    _query: ListMessagesQueryDto,
  ): Promise<MessagePageResponse> {
    // TODO(impl): Verify membership in roomMember.
    // Query prisma.message.findMany({
    //   where: { roomId },
    //   take: _query.limit ?? 30,
    //   cursor: _query.cursor ? { id: _query.cursor } : undefined,
    //   orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    //   include: { sender: true, attachments: { include: { media: true } }, reactions: true, replyTo: { select: { id: true, body: true, sender: { select: { name: true } } } } }
    // })
    return {
      items: [
        {
          id: '018f3a5a-8b9a-7c2d-9e1f-333333333333',
          roomId,
          sender: {
            id: userId,
            name: 'Current User',
            image: null,
          },
          clientMessageId: '018f3a5a-8b9a-7c2d-9e1f-222222222222',
          body: 'Hello world!',
          replyTo: null,
          attachments: [],
          reactions: [],
          nodeId: getNodeId(),
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
        },
      ],
      nextCursor: null,
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
    // TODO(impl): Verify room membership.
    // Handle idempotency via unique (roomId, senderId, clientMessageId).
    // Execute inside transaction:
    // 1. prisma.message.create({ data: { roomId, senderId: userId, clientMessageId: dto.clientMessageId, body: dto.body, replyToId: dto.replyToId, nodeId: getNodeId() } })
    // 2. Attach media: prisma.attachment.createMany({ data: (dto.mediaIds ?? []).map(mediaId => ({ messageId, mediaId })) })
    // 3. prisma.room.update({ where: { id: roomId }, data: { updatedAt: new Date() } })
    // 4. Broadcast message:new over Redis pub/sub.
    return {
      id: '018f3a5a-8b9a-7c2d-9e1f-333333333333',
      roomId,
      sender: {
        id: userId,
        name: 'Current User',
        image: null,
      },
      clientMessageId: dto.clientMessageId,
      body: dto.body ?? null,
      replyTo: dto.replyToId
        ? {
            id: dto.replyToId,
            body: 'Replied message snippet',
            senderName: 'Jane Doe',
          }
        : null,
      attachments: [],
      reactions: [],
      nodeId: getNodeId(),
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
  }

  /**
   * Edits an existing message sent by the caller.
   */
  async editMessage(
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<MessageResponse> {
    // TODO(impl): Verify message.senderId === userId and message.deletedAt === null.
    // Update prisma.message.update({ where: { id: messageId }, data: { body: dto.body, editedAt: new Date() } })
    // Broadcast message:updated over Redis pub/sub.
    return {
      id: messageId,
      roomId: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
      sender: {
        id: userId,
        name: 'Current User',
        image: null,
      },
      clientMessageId: '018f3a5a-8b9a-7c2d-9e1f-222222222222',
      body: dto.body,
      replyTo: null,
      attachments: [],
      reactions: [],
      nodeId: getNodeId(),
      createdAt: new Date().toISOString(),
      editedAt: new Date().toISOString(),
      deletedAt: null,
    };
  }

  /**
   * Soft-deletes a message sent by the caller.
   */
  async deleteMessage(_userId: string, _messageId: string): Promise<void> {
    // TODO(impl): Verify message.senderId === _userId.
    // Soft delete: prisma.message.update({ where: { id: _messageId }, data: { deletedAt: new Date(), body: null } })
    // Broadcast message:deleted over Redis pub/sub.
  }

  /**
   * Adds an emoji reaction to a message.
   */
  async addReaction(
    _userId: string,
    _messageId: string,
    dto: AddReactionDto,
  ): Promise<ReactionSummaryResponse[]> {
    // TODO(impl): Upsert prisma.messageReaction.upsert({ where: { messageId_userId_emoji: { messageId: _messageId, userId: _userId, emoji: dto.emoji } } })
    // Group and count reactions for message: prisma.messageReaction.groupBy({ by: ['emoji'], where: { messageId: _messageId }, _count: true })
    // Broadcast reaction:updated event.
    return [
      {
        emoji: dto.emoji,
        count: 1,
        reactedByMe: true,
      },
    ];
  }

  /**
   * Removes a previously added emoji reaction.
   */
  async removeReaction(
    _userId: string,
    _messageId: string,
    _query: RemoveReactionQueryDto,
  ): Promise<ReactionSummaryResponse[]> {
    // TODO(impl): Delete prisma.messageReaction.deleteMany({ where: { messageId: _messageId, userId: _userId, emoji: _query.emoji } })
    // Re-count reactions: prisma.messageReaction.groupBy({ by: ['emoji'], where: { messageId: _messageId }, _count: true })
    // Broadcast reaction:updated event.
    return [];
  }

  /**
   * Retrieves delivery and read receipts for a specific message.
   */
  async getReceipts(
    userId: string,
    _messageId: string,
  ): Promise<ReceiptResponse[]> {
    // TODO(impl): Verify caller belongs to the message's room.
    // Query prisma.messageReceipt.findMany({ where: { messageId: _messageId } })
    return [
      {
        userId,
        status: ReceiptStatus.READ,
        deliveredAt: new Date().toISOString(),
        readAt: new Date().toISOString(),
      },
    ];
  }
}
