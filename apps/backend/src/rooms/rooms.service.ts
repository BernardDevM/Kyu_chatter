import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberRole,
  ReceiptStatus,
  RoomType,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  MarkReadResponse,
  RoomDetailResponse,
  RoomMemberResponse,
  RoomPageResponse,
  RoomPreferenceResponse,
  RoomPreferenceUpdateResponse,
  RoomSummaryResponse,
} from './dto/room.response.js';
import type { CreateGroupRoomDto } from './dto/create-group-room.dto.js';
import type { CreateDirectRoomDto } from './dto/create-direct-room.dto.js';
import type { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import type { UpdateRoomDto } from './dto/update-room.dto.js';
import type { AddMembersDto } from './dto/add-members.dto.js';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import type { UpdateRoomPreferenceDto } from './dto/update-room-preference.dto.js';
import type { MarkReadDto } from './dto/mark-read.dto.js';

const USER_SUMMARY_SELECT = { id: true, name: true, image: true } as const;

/** Relations needed to build a `RoomSummaryResponse` / `RoomDetailResponse`. */
function roomInclude(userId: string) {
  return {
    preferences: { where: { userId } },
    members: {
      include: { user: { select: USER_SUMMARY_SELECT } },
      orderBy: { joinedAt: 'asc' as const },
    },
    messages: {
      take: 1,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      select: { id: true, senderId: true, body: true, createdAt: true },
    },
  };
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new group chat room with members and assigns the creator OWNER role.
   */
  async createGroupRoom(
    userId: string,
    dto: CreateGroupRoomDto,
  ): Promise<RoomDetailResponse> {
    // Remove duplicate IDs and prevent adding the creator twice.
    const uniqueMemberIds = Array.from(
      new Set(dto.memberUserIds.filter((id) => id !== userId)),
    );

    // Validate that all requested members exist.
    if (uniqueMemberIds.length > 0) {
      const existingUsers = await this.prisma.user.findMany({
        where: {
          id: { in: uniqueMemberIds },
        },
        select: {
          id: true,
        },
      });

      const existingUserIds = new Set(existingUsers.map((user) => user.id));

      const invalidMemberIds = uniqueMemberIds.filter(
        (id) => !existingUserIds.has(id),
      );

      if (invalidMemberIds.length > 0) {
        throw new NotFoundException(
          `The following users were not found: ${invalidMemberIds.join(', ')}`,
        );
      }
    }

    // Create the group and all memberships atomically.
    if (uniqueMemberIds.length === 0) {
      throw new BadRequestException(
        'memberUserIds must include at least one user other than yourself',
      );
    }

    const existingUsers = await this.prisma.user.count({
      where: { id: { in: uniqueMemberIds } },
    });
    if (existingUsers !== uniqueMemberIds.length) {
      throw new BadRequestException('One or more invited users do not exist');
    }

    const room = await this.prisma.room.create({
      data: {
        type: RoomType.GROUP,
        name: dto.name,
        description: dto.description ?? null,
        image: dto.image ?? null,
        createdById: userId,
        members: {
          create: [
            {
              userId,
              role: MemberRole.OWNER,
            },
            ...uniqueMemberIds.map((memberId) => ({
              userId: memberId,
              role: MemberRole.MEMBER,
            })),
          ],
        },
      },
      select: { id: true },
    });

    return this.getRoom(userId, room.id);
  }

  /**
   * Gets or creates a direct 1-on-1 chat room between two users using a sorted directKey.
   */
  async createDirectRoom(
    userId: string,
    dto: CreateDirectRoomDto,
  ): Promise<RoomDetailResponse> {
    if (userId === dto.userId) {
      throw new BadRequestException(
        'Cannot create a direct room with yourself',
      );
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot create a direct room with yourself');
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      select: { id: true },
    });
    if (!otherUser) {
      throw new NotFoundException(`User with ID ${dto.targetUserId} not found`);
    }

    const directKey = [userId, dto.targetUserId].sort().join(':');

    let room = await this.prisma.room.findUnique({
      where: { directKey },
      select: { id: true },
    });

    if (!room) {
      try {
        room = await this.prisma.room.create({
          data: {
            type: RoomType.DIRECT,
            directKey,
            createdById: userId,
            members: {
              create: [
                { userId, role: MemberRole.MEMBER },
                { userId: dto.userId, role: MemberRole.MEMBER },
              ],
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
            preferences: {
              where: { userId },
            },
            messages: {
              take: 1,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                sender: {
                  select: { id: true, name: true, image: true },
                },
                attachments: { include: { media: true } },
                reactions: true,
              },
            },
          },
        });
      } catch (error: unknown) {
        // Prisma P2002 means a unique constraint was violated.
        const isUniqueConstraintError =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002';

        if (!isUniqueConstraintError) {
          throw error;
        }

        // Another request may have created this direct room first.
        room = await this.prisma.room.findUnique({
          where: { directKey },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
            preferences: {
              where: { userId },
            },
            messages: {
              take: 1,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                sender: {
                  select: { id: true, name: true, image: true },
                },
                attachments: { include: { media: true } },
                reactions: true,
              },
            },
          },
        });

        // If the conflicting record was not our directKey,
        // preserve and propagate the original database error.
        if (!room) {
          throw error;
        }
                { userId: dto.targetUserId, role: MemberRole.MEMBER },
              ],
            },
          },
          select: { id: true },
        });
      } catch (err: unknown) {
        // A concurrent request created the same direct room first.
        if ((err as { code?: string })?.code !== 'P2002') throw err;
        room = await this.prisma.room.findUnique({
          where: { directKey },
          select: { id: true },
        });
        if (!room) throw err;
      }
    }

    return this.getRoom(userId, room.id);
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
        room: { include: roomInclude(userId) },
      },
    });

    let filtered = memberships;
    if (query.isArchived !== undefined) {
      filtered = filtered.filter((m) => {
        const pref = m.room.preferences[0];
        const isArchived = pref?.isArchived ?? false;
        return isArchived === query.isArchived;
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
    const nextCursor = hasMore
      ? (pageMemberships[pageMemberships.length - 1]?.room.id ?? null)
      : null;

    const items = await Promise.all(
      pageMemberships.map((m) => this.toRoomSummary(m.room, m, userId)),
    );

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves full details (including the member list) for a room if the caller is a member.
   */
  async getRoom(userId: string, roomId: string): Promise<RoomDetailResponse> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: { include: roomInclude(userId) },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Room with ID ${roomId} not found or you are not a member`,
      );
    }

    const room = member.room;
    const summary = await this.toRoomSummary(room, member, userId);

    return {
      ...summary,
      members: room.members.map((m) => this.toMemberResponse(m)),
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
   * Lists all members of a room with their roles.
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
      include: { user: { select: USER_SUMMARY_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => this.toMemberResponse(m));
  }

  /**
   * Adds new users as members to an existing group room.
   */
  async addMembers(
    userId: string,
    roomId: string,
    dto: AddMembersDto,
  ): Promise<RoomMemberResponse[]> {
    // 1. Verify caller membership and room type.
    const callerMember = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
      include: {
        room: true,
      },
    });

    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (callerMember.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Cannot add members to a direct room');
    }

    // 2. Verify caller permissions.
    if (
      callerMember.role !== MemberRole.OWNER &&
      callerMember.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException('Only room owner or admin can add members');
    }

    // 3. Remove duplicate IDs and existing members.
    const existingMembers = await this.prisma.roomMember.findMany({
      where: { roomId },
      select: { userId: true },
    });

    const existingSet = new Set(existingMembers.map((member) => member.userId));

    const newIds = Array.from(new Set(dto.userIds)).filter(
      (id) => !existingSet.has(id),
    );

    if (newIds.length === 0) {
      return [];
    }

    // 4. Validate that every requested user exists.
    const users = await this.prisma.user.findMany({
      where: { id: { in: newIds } },
      select: USER_SUMMARY_SELECT,
    });

    const foundIds = new Set(users.map((user) => user.id));

    const invalidIds = newIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      throw new NotFoundException(
        `The following users were not found: ${invalidIds.join(', ')}`,
      );
    }

    if (users.length === 0) {
      return [];
    }

    // 5. Create memberships.
const now = new Date();

await this.prisma.roomMember.createMany({
  data: users.map((u) => ({
    roomId,
    userId: u.id,
    role: MemberRole.MEMBER,
    joinedAt: now,
  })),
  skipDuplicates: true,
});

// 6. Retrieve the newly added memberships.
// 5. Create memberships and identify users added by this request.
const addedMembers = [];

for (const user of users) {
  const result = await this.prisma.roomMember.createMany({
    data: [
      {
        roomId,
        userId: user.id,
        role: MemberRole.MEMBER,
      },
    ],
    skipDuplicates: true,
  });

  // count === 1 means this request actually inserted the membership.
  if (result.count === 1) {
    const membership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (membership) {
      addedMembers.push(membership);
    }
  }
}

    // 7. Retrieve their presence.
    const presenceRes = await this.presenceService.getPresence(
      userId,
      addedMembers.map((member) => member.userId),
    );

    // 8. Return newly added members.
    return addedMembers.map((member) => ({
      user: {
        id: member.user.id,
        name: member.user.name,
        image: member.user.image,
      },
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      isOnline: presenceRes.presence[member.userId]?.online ?? false,
    }));
    return users.map((u) =>
      this.toMemberResponse({
        roomId,
        userId: u.id,
        role: MemberRole.MEMBER,
        joinedAt: now,
        user: u,
      }),
    );
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
      throw new ForbiddenException(
        'Only the room owner can change member roles',
      );
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
      include: { user: { select: USER_SUMMARY_SELECT } },
    });

    return this.toMemberResponse(updated);
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
  ): Promise<RoomPreferenceUpdateResponse> {
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
      roomId,
      userId,
      isMuted: pref.isMuted,
      isArchived: pref.isArchived,
      isPinned: pref.isPinned,
    };
  }

  /**
   * Updates the user's read cursor up to messageId and records a READ receipt.
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
      select: {
        id: true,
        roomId: true,
        senderId: true,
        createdAt: true,
      },
    });

    if (!message || message.roomId !== roomId) {
      throw new NotFoundException(
        `Message with ID ${dto.messageId} not found in this room`,
      );
    }

    let effectiveCursorId = member.lastReadMessageId;

    const currentCursor = member.lastReadMessageId
      ? await this.prisma.message.findUnique({
          where: { id: member.lastReadMessageId },
          select: {
            id: true,
            roomId: true,
            createdAt: true,
          },
        })
      : null;

    const currentCursorIsValid = currentCursor?.roomId === roomId;

    const shouldAdvanceCursor =
      !currentCursorIsValid ||
      message.createdAt > currentCursor.createdAt ||
      (message.createdAt.getTime() === currentCursor.createdAt.getTime() &&
        message.id > currentCursor.id);

    if (shouldAdvanceCursor) {
      await this.prisma.roomMember.update({
        where: {
          roomId_userId: { roomId, userId },
        },
        data: {
          lastReadMessageId: message.id,
        },
      });

      effectiveCursorId = message.id;
    }

    const unreadCount = await this.calculateUnreadCount(
      roomId,
      userId,
      effectiveCursorId,
      member.joinedAt,
    );
    const readAt = new Date();

    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadMessageId: dto.messageId },
    });

    await this.prisma.messageReceipt.upsert({
      where: { messageId_userId: { messageId: dto.messageId, userId } },
      update: {
        status: ReceiptStatus.READ,
        readAt,
      },
      create: {
        messageId: dto.messageId,
        userId,
        status: ReceiptStatus.READ,
        readAt,
      },
    });

    return {
      roomId,
      userId,
      lastReadMessageId: dto.messageId,
      readAt: readAt.toISOString(),
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private extractPreferences(
    pref?: {
      isMuted: boolean;
      isArchived: boolean;
      isPinned: boolean;
    } | null,
  ): RoomPreferenceResponse {
    return {
      isMuted: pref?.isMuted ?? false,
      isArchived: pref?.isArchived ?? false,
      isPinned: pref?.isPinned ?? false,
    };
  }

  private toMemberResponse(m: {
    roomId: string;
    userId: string;
    role: MemberRole;
    joinedAt: Date;
    user: { id: string; name: string; image: string | null };
  }): RoomMemberResponse {
    return {
      roomId: m.roomId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        image: m.user.image,
      },
    };
  }

  private async toRoomSummary(
    room: {
      id: string;
      type: RoomType;
      name: string | null;
      description: string | null;
      image: string | null;
      updatedAt: Date;
      members: unknown[];
      preferences: Array<{
        isMuted: boolean;
        isArchived: boolean;
        isPinned: boolean;
      }>;
      messages: Array<{
        id: string;
        senderId: string;
        body: string | null;
        createdAt: Date;
      }>;
    },
    membership: { lastReadMessageId: string | null; joinedAt: Date },
    userId: string,
  ): Promise<RoomSummaryResponse> {
    const unreadCount = await this.calculateUnreadCount(
      room.id,
      userId,
      membership.lastReadMessageId,
      membership.joinedAt,
    );
    const last = room.messages[0];

    return {
      id: room.id,
      type: room.type,
      name: room.name,
      description: room.description,
      image: room.image,
      memberCount: room.members.length,
      lastMessage: last
        ? {
            id: last.id,
            senderId: last.senderId,
            body: last.body,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      preference: this.extractPreferences(room.preferences[0]),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  private async calculateUnreadCount(
    roomId: string,
    userId: string,
    lastReadMessageId?: string | null,
    joinedAt?: Date,
  ): Promise<number> {
    const baseWhere = {
      roomId,
      senderId: { not: userId },
      ...(joinedAt ? { createdAt: { gte: joinedAt } } : {}),
    };

    if (!lastReadMessageId) {
      return this.prisma.message.count({
        where: baseWhere,
      });
    }

    const lastReadMessage = await this.prisma.message.findUnique({
      where: { id: lastReadMessageId },
      select: {
        id: true,
        roomId: true,
        createdAt: true,
      },
    });

    // If the cursor message was deleted or does not belong to this room,
    // fall back to counting messages since the member joined.
    if (!lastReadMessage || lastReadMessage.roomId !== roomId) {
      return this.prisma.message.count({
        where: baseWhere,
      });
    }

    return this.prisma.message.count({
      where: {
        ...baseWhere,
        OR: [
          {
            createdAt: {
              gt: lastReadMessage.createdAt,
            },
          },
          {
            createdAt: lastReadMessage.createdAt,
            id: {
              gt: lastReadMessage.id,
            },
          },
        ],
      },
    });
  }
}
