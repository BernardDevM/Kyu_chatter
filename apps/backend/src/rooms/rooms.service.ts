import { Injectable } from '@nestjs/common';
import { MemberRole, RoomType } from '../generated/prisma/enums.js';
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

@Injectable()
export class RoomsService {
  /**
   * Creates a new group chat room with members and assigns the creator OWNER role.
   */
  async createGroupRoom(
    userId: string,
    dto: CreateGroupRoomDto,
  ): Promise<RoomDetailResponse> {
    // TODO(impl): Execute inside a prisma transaction:
    // 1. prisma.room.create({ data: { type: RoomType.GROUP, name: dto.name, description: dto.description, image: dto.image, createdById: userId } })
    // 2. prisma.roomMember.createMany({ data: [{ roomId, userId, role: MemberRole.OWNER }, ...dto.memberIds.map(id => ({ roomId, userId: id, role: MemberRole.MEMBER }))] })
    // 3. Emit room:updated and member:joined events over Redis pub/sub.
    return {
      id: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
      type: RoomType.GROUP,
      name: dto.name,
      description: dto.description ?? null,
      image: dto.image ?? null,
      lastMessage: null,
      unreadCount: 0,
      preferences: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      directKey: null,
      createdById: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      myRole: MemberRole.OWNER,
      memberCount: dto.memberIds.length + 1,
    };
  }

  /**
   * Gets or creates a direct 1-on-1 chat room between two users using a sorted directKey.
   */
  async createDirectRoom(
    userId: string,
    dto: CreateDirectRoomDto,
  ): Promise<RoomDetailResponse> {
    // TODO(impl): Calculate directKey = [userId, dto.userId].sort().join(':').
    // 1. Check prisma.room.findUnique({ where: { directKey } }). If found, return it.
    // 2. Otherwise create within transaction: prisma.room.create({ data: { type: RoomType.DIRECT, directKey, createdById: userId } })
    //    and prisma.roomMember.createMany with both users as MEMBER.
    return {
      id: '018f3a5a-8b9a-7c2d-9e1f-222222222222',
      type: RoomType.DIRECT,
      name: null,
      description: null,
      image: null,
      lastMessage: null,
      unreadCount: 0,
      preferences: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      otherUser: {
        id: dto.userId,
        name: 'Chat Partner',
        image: null,
      },
      directKey: [userId, dto.userId].sort().join(':'),
      createdById: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      myRole: MemberRole.MEMBER,
      memberCount: 2,
    };
  }

  /**
   * Lists rooms the user belongs to, ordered by pinned status and latest activity.
   */
  async listRooms(
    _userId: string,
    _query: ListRoomsQueryDto,
  ): Promise<RoomPageResponse> {
    // TODO(impl): prisma.roomMember.findMany({
    //   where: { userId: _userId, room: { type: _query.type, preferences: _query.archived !== undefined ? { some: { userId: _userId, isArchived: _query.archived } } : undefined } },
    //   include: { room: { include: { preferences: { where: { userId: _userId } }, messages: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    //   take: _query.limit ?? 30,
    //   cursor: _query.cursor ? { roomId_userId: { roomId: _query.cursor, userId: _userId } } : undefined,
    //   orderBy: [{ room: { updatedAt: 'desc' } }]
    // })
    return {
      items: [
        {
          id: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
          type: RoomType.GROUP,
          name: 'General Discussion',
          description: 'Official group chat',
          image: null,
          lastMessage: null,
          unreadCount: 0,
          preferences: {
            isMuted: false,
            isArchived: false,
            isPinned: false,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    };
  }

  /**
   * Retrieves full details for a room if the caller is a member.
   */
  async getRoom(userId: string, roomId: string): Promise<RoomDetailResponse> {
    // TODO(impl): Verify caller membership via prisma.roomMember.findUniqueOrThrow({ where: { roomId_userId: { roomId, userId } } })
    // Retrieve room details, count members via prisma.roomMember.count({ where: { roomId } })
    return {
      id: roomId,
      type: RoomType.GROUP,
      name: 'General Discussion',
      description: 'Official group chat',
      image: null,
      lastMessage: null,
      unreadCount: 0,
      preferences: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      directKey: null,
      createdById: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      myRole: MemberRole.OWNER,
      memberCount: 5,
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
    // TODO(impl): Validate that caller has OWNER or ADMIN role in roomMember.
    // Update prisma.room.update({ where: { id: roomId }, data: { name: dto.name, description: dto.description, image: dto.image } })
    // Broadcast room:updated event to all room members.
    return {
      id: roomId,
      type: RoomType.GROUP,
      name: dto.name ?? 'General Discussion',
      description: dto.description ?? 'Updated description',
      image: dto.image ?? null,
      lastMessage: null,
      unreadCount: 0,
      preferences: {
        isMuted: false,
        isArchived: false,
        isPinned: false,
      },
      directKey: null,
      createdById: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      myRole: MemberRole.OWNER,
      memberCount: 5,
    };
  }

  /**
   * Deletes a group room (owner only).
   */
  async deleteRoom(_userId: string, _roomId: string): Promise<void> {
    // TODO(impl): Ensure room.type === RoomType.GROUP and caller is OWNER.
    // Cascade delete prisma.room.delete({ where: { id: _roomId } })
    // Disconnect active socket rooms and broadcast room:deleted.
  }

  /**
   * Lists all members of a room with their roles and online status.
   */
  async listMembers(
    userId: string,
    _roomId: string,
  ): Promise<RoomMemberResponse[]> {
    // TODO(impl): Ensure caller is a member of the room.
    // Fetch members via prisma.roomMember.findMany({ where: { roomId: _roomId }, include: { user: true } })
    // Check Redis presence for each member's isOnline status.
    return [
      {
        user: {
          id: userId,
          name: 'Current User',
          image: null,
        },
        role: MemberRole.OWNER,
        joinedAt: new Date().toISOString(),
        isOnline: true,
      },
      {
        user: {
          id: 'usr_sample_2',
          name: 'Jane Doe',
          image: null,
        },
        role: MemberRole.MEMBER,
        joinedAt: new Date().toISOString(),
        isOnline: false,
      },
    ];
  }

  /**
   * Adds new users as members to an existing group room.
   */
  async addMembers(
    _userId: string,
    _roomId: string,
    dto: AddMembersDto,
  ): Promise<RoomMemberResponse[]> {
    // TODO(impl): Ensure caller is OWNER or ADMIN in roomMember.
    // Filter out existing members, create new roomMember rows with MemberRole.MEMBER.
    // Broadcast member:joined event to the room socket channel.
    return dto.userIds.map((id) => ({
      user: {
        id,
        name: `User ${id}`,
        image: null,
      },
      role: MemberRole.MEMBER,
      joinedAt: new Date().toISOString(),
      isOnline: false,
    }));
  }

  /**
   * Changes the role of a room member (owner only, or admin promoting to member).
   */
  async updateMemberRole(
    _userId: string,
    _roomId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<RoomMemberResponse> {
    // TODO(impl): Ensure caller has permission to alter roles.
    // Update prisma.roomMember.update({ where: { roomId_userId: { roomId: _roomId, userId: targetUserId } }, data: { role: dto.role } })
    return {
      user: {
        id: targetUserId,
        name: 'Updated Member',
        image: null,
      },
      role: dto.role,
      joinedAt: new Date().toISOString(),
      isOnline: false,
    };
  }

  /**
   * Removes a member from a room (owner/admin, or self-removal).
   */
  async removeMember(
    _userId: string,
    _roomId: string,
    _targetUserId: string,
  ): Promise<void> {
    // TODO(impl): Validate caller role (owner/admin) or self-removal.
    // Prevent removing the sole OWNER unless transferring ownership.
    // Delete prisma.roomMember.delete({ where: { roomId_userId: { roomId: _roomId, userId: _targetUserId } } })
    // Broadcast member:left.
  }

  /**
   * Leaves a room.
   */
  async leaveRoom(_userId: string, _roomId: string): Promise<void> {
    // TODO(impl): Call removeMember for self. If caller is sole OWNER, throw BadRequestException or promote next member.
  }

  /**
   * Updates user preferences (isMuted, isArchived, isPinned) for a room.
   */
  async updatePreferences(
    _userId: string,
    _roomId: string,
    dto: UpdateRoomPreferenceDto,
  ): Promise<RoomPreferenceResponse> {
    // TODO(impl): Upsert prisma.roomPreference.upsert({
    //   where: { roomId_userId: { roomId: _roomId, userId: _userId } },
    //   update: { isMuted: dto.isMuted, isArchived: dto.isArchived, isPinned: dto.isPinned },
    //   create: { roomId: _roomId, userId: _userId, isMuted: dto.isMuted ?? false, isArchived: dto.isArchived ?? false, isPinned: dto.isPinned ?? false }
    // })
    return {
      isMuted: dto.isMuted ?? false,
      isArchived: dto.isArchived ?? false,
      isPinned: dto.isPinned ?? false,
    };
  }

  /**
   * Updates the user's read cursor up to messageId and returns the remaining unread count.
   */
  async markRead(
    _userId: string,
    roomId: string,
    dto: MarkReadDto,
  ): Promise<MarkReadResponse> {
    // TODO(impl): Update prisma.roomMember.update({
    //   where: { roomId_userId: { roomId, userId: _userId } },
    //   data: { lastReadMessageId: dto.messageId }
    // })
    // Count unread: prisma.message.count({ where: { roomId, createdAt: { gt: targetMessage.createdAt } } })
    // Broadcast message:read receipt event.
    return {
      roomId,
      lastReadMessageId: dto.messageId,
      unreadCount: 0,
    };
  }
}
