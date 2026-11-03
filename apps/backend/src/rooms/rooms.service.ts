import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, ReceiptStatus, RoomType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresenceService } from '../chat/presence.service.js';
import type {
  MarkReadResponse,
  RoomDetailResponse,
  RoomMemberResponse,
  RoomPageResponse,
  RoomPreferenceResponse,
} from './dto/room.response.js';
import type { CreateGroupRoomDto } from './dto/create-group-room.dto.js';
import type { CreateDirectRoomDto } from './dto/create-direct-room.dto.js';
import type { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import type { UpdateRoomDto } from './dto/update-room.dto.js';
import type { AddMembersDto } from './dto/add-members.dto.js';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import type { UpdateRoomPreferenceDto } from './dto/update-room-preference.dto.js';
import type { MarkReadDto } from './dto/mark-read.dto.js';
import type { MessageResponse } from '../messages/dto/message.response.js';
import type { UserSummaryResponse } from '../users/dto/user.response.js';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  /**
   * Creates a new group chat room with members and assigns the creator OWNER role.
   */
  async createGroupRoom(
    userId: string,
    dto: CreateGroupRoomDto,
  ): Promise<RoomDetailResponse> {
    const uniqueMemberIds = Array.from(
      new Set(dto.memberIds.filter((id) => id !== userId)),
    );

    const room = await this.prisma.room.create({
      data: {
        type: RoomType.GROUP,
        name: dto.name,
        description: dto.description ?? null,
        image: dto.image ?? null,
        createdById: userId,
        members: {
          create: [
            { userId, role: MemberRole.OWNER },
            ...uniqueMemberIds.map((memberId) => ({
              userId: memberId,
              role: MemberRole.MEMBER,
            })),
          ],
        },
      },
    });

    return {
      id: room.id,
      type: RoomType.GROUP,
      name: room.name,
      description: room.description,
      image: room.image,
      lastMessage: null,
      unreadCount: 0,
      preference: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      preferences: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      directKey: null,
      createdById: room.createdById,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      myRole: MemberRole.OWNER,
      memberCount: 1 + uniqueMemberIds.length,
    };
  }

  /**
   * Gets or creates a direct 1-on-1 chat room between two users using a sorted directKey.
   */
  async createDirectRoom(
    userId: string,
    dto: CreateDirectRoomDto,
  ): Promise<RoomDetailResponse> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot create a direct room with yourself');
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      select: { id: true, name: true, image: true },
    });
    if (!otherUser) {
      throw new NotFoundException(`User with ID ${dto.targetUserId} not found`);
    }

    const directKey = [userId, dto.targetUserId].sort().join(':');

    let room = await this.prisma.room.findUnique({
      where: { directKey },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        preferences: {
          where: { userId },
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            sender: { select: { id: true, name: true, image: true } },
            attachments: { include: { media: true } },
            reactions: true,
          },
        },
      },
    });

    if (!room) {
      room = await this.prisma.room.create({
        data: {
          type: RoomType.DIRECT,
          directKey,
          createdById: userId,
          members: {
            create: [
              { userId, role: MemberRole.MEMBER },
              { userId: dto.targetUserId, role: MemberRole.MEMBER },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          preferences: {
            where: { userId },
          },
          messages: {
            take: 1,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
              sender: { select: { id: true, name: true, image: true } },
              attachments: { include: { media: true } },
              reactions: true,
            },
          },
        },
      });
    }

    const myMember = room.members.find((m) => m.userId === userId);
    const unreadCount = await this.calculateUnreadCount(
      room.id,
      userId,
      myMember?.lastReadMessageId,
      myMember?.joinedAt,
    );

    return {
      id: room.id,
      type: RoomType.DIRECT,
      name: null,
      description: null,
      image: null,
      lastMessage: room.messages[0]
        ? this.mapMessageToResponse(room.messages[0], userId)
        : null,
      unreadCount,
      preference: this.extractPreferences(room.preferences[0]),
      preferences: this.extractPreferences(room.preferences[0]),
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        image: otherUser.image,
      },
      directKey: room.directKey,
      createdById: room.createdById,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      myRole: myMember?.role ?? MemberRole.MEMBER,
      memberCount: room.members.length,
    };
  }

  /**
   * Lists rooms the user belongs to, ordered by pinned status and latest activity.
   */
  async listRooms(
    userId: string,
    query: ListRoomsQueryDto,
  ): Promise<RoomPageResponse> {
    const memberships = await this.prisma.roomMember.findMany({
      where: {
        userId,
        room: query.type ? { type: query.type } : undefined,
      },
      include: {
        room: {
          include: {
            preferences: {
              where: { userId },
            },
            members: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
            messages: {
              take: 1,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                sender: { select: { id: true, name: true, image: true } },
                attachments: { include: { media: true } },
                reactions: true,
              },
            },
          },
        },
      },
    });

    let filtered = memberships;
    if (query.archived !== undefined) {
      filtered = filtered.filter((m) => {
        const pref = m.room.preferences[0];
        const isArchived = pref?.isArchived ?? false;
        return isArchived === query.archived;
      });
    }

    filtered.sort((a, b) => {
      const aPinned = a.room.preferences[0]?.isPinned ? 1 : 0;
      const bPinned = b.room.preferences[0]?.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aTime = a.room.messages[0]?.createdAt ?? a.room.updatedAt;
      const bTime = b.room.messages[0]?.createdAt ?? b.room.updatedAt;
      return bTime.getTime() - aTime.getTime();
    });

    let startIndex = 0;
    if (query.cursor) {
      const cursorIndex = filtered.findIndex((m) => m.room.id === query.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const limit = query.limit ?? 30;
    const pageMemberships = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const nextCursor =
      hasMore ? pageMemberships[pageMemberships.length - 1]?.room.id ?? null : null;

    const items = await Promise.all(
      pageMemberships.map(async (m) => {
        const room = m.room;
        const unreadCount = await this.calculateUnreadCount(
          room.id,
          userId,
          m.lastReadMessageId,
          m.joinedAt,
        );
        const pref = this.extractPreferences(room.preferences[0]);
        const lastMessage = room.messages[0]
          ? this.mapMessageToResponse(room.messages[0], userId)
          : null;

        let otherUser: UserSummaryResponse | undefined;
        if (room.type === RoomType.DIRECT) {
          const partner = room.members.find((rm) => rm.userId !== userId);
          if (partner) {
            otherUser = {
              id: partner.user.id,
              name: partner.user.name,
              image: partner.user.image,
            };
          }
        }

        return {
          id: room.id,
          type: room.type,
          name: room.name,
          description: room.description,
          image: room.image,
          memberCount: room.members.length,
          lastMessage,
          unreadCount,
          preference: pref,
          preferences: pref,
          otherUser,
          updatedAt: room.updatedAt.toISOString(),
        };
      }),
    );

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves full details for a room if the caller is a member.
   */
  async getRoom(userId: string, roomId: string): Promise<RoomDetailResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: {
          include: {
            preferences: { where: { userId } },
            members: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
            messages: {
              take: 1,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                sender: { select: { id: true, name: true, image: true } },
                attachments: { include: { media: true } },
                reactions: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Room with ID ${roomId} not found or you are not a member`,
      );
    }

    const room = member.room;
    const unreadCount = await this.calculateUnreadCount(
      room.id,
      userId,
      member.lastReadMessageId,
      member.joinedAt,
    );

    let otherUser: UserSummaryResponse | undefined;
    if (room.type === RoomType.DIRECT) {
      const partner = room.members.find((rm) => rm.userId !== userId);
      if (partner) {
        otherUser = {
          id: partner.user.id,
          name: partner.user.name,
          image: partner.user.image,
        };
      }
    }

    return {
      id: room.id,
      type: room.type,
      name: room.name,
      description: room.description,
      image: room.image,
      lastMessage: room.messages[0]
        ? this.mapMessageToResponse(room.messages[0], userId)
        : null,
      unreadCount,
      preference: this.extractPreferences(room.preferences[0]),
      preferences: this.extractPreferences(room.preferences[0]),
      otherUser,
      directKey: room.directKey,
      createdById: room.createdById,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      myRole: member.role,
      memberCount: room.members.length,
    };
  }

  /**
   * Updates group room details (owner or admin only).
   */
  async updateRoom(
    userId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<RoomDetailResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });

    if (!member) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }
    if (member.role !== MemberRole.OWNER && member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException(
        'Only room owner or admin can update room details',
      );
    }
    if (member.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Direct rooms cannot be edited');
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.image !== undefined && { image: dto.image }),
      },
    });

    return this.getRoom(userId, roomId);
  }

  /**
   * Deletes a group room (owner only).
   */
  async deleteRoom(userId: string, roomId: string): Promise<void> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });

    if (!member) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }
    if (member.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can delete the room');
    }
    if (member.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Direct rooms cannot be deleted');
    }

    await this.prisma.room.delete({
      where: { id: roomId },
    });
  }

  /**
   * Lists all members of a room with their roles and online status.
   */
  async listMembers(
    userId: string,
    roomId: string,
  ): Promise<RoomMemberResponse[]> {
    const callerMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const targetUserIds = members.map((m) => m.userId);
    const presenceRes = await this.presenceService.getPresence(
      userId,
      targetUserIds,
    );

    return members.map((m) => ({
      user: {
        id: m.user.id,
        name: m.user.name,
        image: m.user.image,
      },
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isOnline: presenceRes.presence[m.userId]?.online ?? false,
    }));
  }

  /**
   * Adds new users as members to an existing group room.
   */
  async addMembers(
    userId: string,
    roomId: string,
    dto: AddMembersDto,
  ): Promise<RoomMemberResponse[]> {
    const callerMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });

    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this room');
    }
    if (callerMember.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Cannot add members to a direct room');
    }
    if (
      callerMember.role !== MemberRole.OWNER &&
      callerMember.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException('Only room owner or admin can add members');
    }

    const existingMembers = await this.prisma.roomMember.findMany({
      where: { roomId },
      select: { userId: true },
    });
    const existingSet = new Set(existingMembers.map((m) => m.userId));
    const newIds = Array.from(new Set(dto.userIds)).filter(
      (id) => !existingSet.has(id),
    );

    if (newIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: newIds } },
      select: { id: true, name: true, image: true },
    });
    if (users.length === 0) {
      return [];
    }

    const now = new Date();
    await this.prisma.roomMember.createMany({
      data: users.map((u) => ({
        roomId,
        userId: u.id,
        role: MemberRole.MEMBER,
        joinedAt: now,
      })),
    });

    const presenceRes = await this.presenceService.getPresence(
      userId,
      users.map((u) => u.id),
    );

    return users.map((u) => ({
      user: {
        id: u.id,
        name: u.name,
        image: u.image,
      },
      role: MemberRole.MEMBER,
      joinedAt: now.toISOString(),
      isOnline: presenceRes.presence[u.id]?.online ?? false,
    }));
  }

  /**
   * Changes the role of a room member (owner only).
   */
  async updateMemberRole(
    userId: string,
    roomId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<RoomMemberResponse> {
    const callerMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });

    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this room');
    }
    if (callerMember.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Cannot change roles in a direct room');
    }
    if (callerMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can change member roles');
    }
    if (targetUserId === userId) {
      throw new BadRequestException('Cannot change your own role as owner');
    }

    const targetMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!targetMember) {
      throw new NotFoundException(
        `Member with ID ${targetUserId} not found in this room`,
      );
    }

    const updated = await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    const presenceRes = await this.presenceService.getPresence(userId, [
      targetUserId,
    ]);

    return {
      user: {
        id: updated.user.id,
        name: updated.user.name,
        image: updated.user.image,
      },
      role: updated.role,
      joinedAt: updated.joinedAt.toISOString(),
      isOnline: presenceRes.presence[targetUserId]?.online ?? false,
    };
  }

  /**
   * Removes a member from a room (owner/admin, or self-removal).
   */
  async removeMember(
    userId: string,
    roomId: string,
    targetUserId: string,
  ): Promise<void> {
    const callerMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });

    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const targetMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!targetMember) {
      throw new NotFoundException(
        `Member with ID ${targetUserId} not found in this room`,
      );
    }

    const isSelf = userId === targetUserId;
    if (!isSelf) {
      if (callerMember.role === MemberRole.MEMBER) {
        throw new ForbiddenException('Members cannot remove other users');
      }
      if (
        callerMember.role === MemberRole.ADMIN &&
        (targetMember.role === MemberRole.OWNER ||
          targetMember.role === MemberRole.ADMIN)
      ) {
        throw new ForbiddenException(
          'Admins cannot remove other admins or the owner',
        );
      }
    }

    if (targetMember.role === MemberRole.OWNER) {
      throw new BadRequestException(
        'Owner cannot leave or be removed from the room without transferring ownership or deleting the room',
      );
    }

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
  }

  /**
   * Leaves a room.
   */
  async leaveRoom(userId: string, roomId: string): Promise<void> {
    await this.removeMember(userId, roomId, userId);
  }

  /**
   * Updates user preferences (isMuted, isArchived, isPinned) for a room.
   */
  async updatePreferences(
    userId: string,
    roomId: string,
    dto: UpdateRoomPreferenceDto,
  ): Promise<RoomPreferenceResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new NotFoundException(
        `Room with ID ${roomId} not found or you are not a member`,
      );
    }

    const pref = await this.prisma.roomPreference.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: {
        ...(dto.isMuted !== undefined && { isMuted: dto.isMuted }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      create: {
        roomId,
        userId,
        isMuted: dto.isMuted ?? false,
        isArchived: dto.isArchived ?? false,
        isPinned: dto.isPinned ?? false,
      },
    });

    return {
      isMuted: pref.isMuted,
      isArchived: pref.isArchived,
      isPinned: pref.isPinned,
    };
  }

  /**
   * Updates the user's read cursor up to messageId and returns the remaining unread count.
   */
  async markRead(
    userId: string,
    roomId: string,
    dto: MarkReadDto,
  ): Promise<MarkReadResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new NotFoundException(
        `Room with ID ${roomId} not found or you are not a member`,
      );
    }

    const message = await this.prisma.message.findUnique({
      where: { id: dto.messageId },
    });
    if (!message || message.roomId !== roomId) {
      throw new NotFoundException(
        `Message with ID ${dto.messageId} not found in this room`,
      );
    }

    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadMessageId: dto.messageId },
    });

    await this.prisma.messageReceipt.upsert({
      where: { messageId_userId: { messageId: dto.messageId, userId } },
      update: {
        status: ReceiptStatus.READ,
        readAt: new Date(),
      },
      create: {
        messageId: dto.messageId,
        userId,
        status: ReceiptStatus.READ,
        readAt: new Date(),
      },
    });

    const unreadCount = await this.prisma.message.count({
      where: {
        roomId,
        senderId: { not: userId },
        createdAt: { gt: message.createdAt },
      },
    });

    return {
      roomId,
      lastReadMessageId: dto.messageId,
      unreadCount,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private extractPreferences(pref?: {
    isMuted: boolean;
    isArchived: boolean;
    isPinned: boolean;
  } | null): RoomPreferenceResponse {
    return {
      isMuted: pref?.isMuted ?? false,
      isArchived: pref?.isArchived ?? false,
      isPinned: pref?.isPinned ?? false,
    };
  }

  private async calculateUnreadCount(
    roomId: string,
    userId: string,
    lastReadMessageId?: string | null,
    joinedAt?: Date,
  ): Promise<number> {
    if (!lastReadMessageId) {
      return this.prisma.message.count({
        where: {
          roomId,
          senderId: { not: userId },
          ...(joinedAt ? { createdAt: { gte: joinedAt } } : {}),
        },
      });
    }

    const lastReadMessage = await this.prisma.message.findUnique({
      where: { id: lastReadMessageId },
      select: { createdAt: true },
    });

    if (!lastReadMessage) {
      return this.prisma.message.count({
        where: {
          roomId,
          senderId: { not: userId },
          ...(joinedAt ? { createdAt: { gte: joinedAt } } : {}),
        },
      });
    }

    return this.prisma.message.count({
      where: {
        roomId,
        senderId: { not: userId },
        createdAt: { gt: lastReadMessage.createdAt },
      },
    });
  }

  private mapMessageToResponse(
    msg: any,
    _currentUserId: string,
  ): MessageResponse {
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
      reactions: [],
      nodeId: msg.nodeId,
      createdAt: msg.createdAt.toISOString(),
      editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
      deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : null,
    };
  }
}
