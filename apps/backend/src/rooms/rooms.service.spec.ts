import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MemberRole, RoomType } from '../generated/prisma/enums.js';

describe('RoomsService', () => {
  let service: RoomsService;
  let prismaMock: any;

  const now = new Date('2026-01-01T00:00:00.000Z');

  /** A `roomMember.findUnique` result (with room) as consumed by `getRoom`. */
  const membershipWithRoom = (
    room: Record<string, unknown>,
    role: MemberRole = MemberRole.OWNER,
  ) => ({
    roomId: room.id,
    userId: 'user_1',
    role,
    lastReadMessageId: null,
    joinedAt: now,
    room: {
      description: null,
      image: null,
      name: null,
      updatedAt: now,
      preferences: [],
      messages: [],
      members: [],
      ...room,
    },
  });

  beforeEach(async () => {
    prismaMock = {
      $transaction: vi.fn((cb) => cb(prismaMock)),
      room: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      roomMember: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      roomPreference: {
        upsert: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      message: {
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn(),
      },
      messageReceipt: {
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGroupRoom', () => {
    it('creates a group room, assigns creator as OWNER and returns detail with members', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'user_2' }, { id: 'user_3' }]);
      prismaMock.room.create.mockResolvedValue({ id: 'room_1' });
      prismaMock.roomMember.findUnique.mockResolvedValue(
        membershipWithRoom({
          id: 'room_1',
          type: RoomType.GROUP,
          name: 'Cool Group',
          description: 'A test group',
          members: [
            { roomId: 'room_1', userId: 'user_1', role: MemberRole.OWNER, joinedAt: now, user: { id: 'user_1', name: 'Alice', image: null } },
            { roomId: 'room_1', userId: 'user_2', role: MemberRole.MEMBER, joinedAt: now, user: { id: 'user_2', name: 'Bob', image: null } },
            { roomId: 'room_1', userId: 'user_3', role: MemberRole.MEMBER, joinedAt: now, user: { id: 'user_3', name: 'Cy', image: null } },
          ],
        }),
      );

      const res = await service.createGroupRoom('user_1', {
        name: 'Cool Group',
        description: 'A test group',
        memberUserIds: ['user_2', 'user_3'],
      });

      expect(prismaMock.room.create).toHaveBeenCalledWith({
        data: {
          type: RoomType.GROUP,
          name: 'Cool Group',
          description: 'A test group',
          image: null,
          createdById: 'user_1',
          members: {
            create: [
              { userId: 'user_1', role: MemberRole.OWNER },
              { userId: 'user_2', role: MemberRole.MEMBER },
              { userId: 'user_3', role: MemberRole.MEMBER },
            ],
          },
        },
        select: { id: true },
      });
      expect(res.id).toBe('room_1');
      expect(res.memberCount).toBe(3);
      expect(res.members).toHaveLength(3);
      expect(res.members[0]).toEqual({
        roomId: 'room_1',
        userId: 'user_1',
        role: MemberRole.OWNER,
        joinedAt: now.toISOString(),
        user: { id: 'user_1', name: 'Alice', image: null },
      });
      expect(res.preference).toEqual({ isMuted: false, isArchived: false, isPinned: false });
    });

    it('throws NotFoundException when an invited user does not exist', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'user_2' }]);

      await expect(
        service.createGroupRoom('user_1', { name: 'G', memberUserIds: ['user_2', 'ghost'] }),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.room.create).not.toHaveBeenCalled();
    });
  });

  describe('createDirectRoom', () => {
    const directRoom = (extra: Record<string, unknown> = {}) =>
      membershipWithRoom(
        {
          id: 'room_direct_1',
          type: RoomType.DIRECT,
          directKey: 'user_1:user_2',
          members: [
            { roomId: 'room_direct_1', userId: 'user_1', role: MemberRole.MEMBER, joinedAt: now, user: { id: 'user_1', name: 'Alice', image: null } },
            { roomId: 'room_direct_1', userId: 'user_2', role: MemberRole.MEMBER, joinedAt: now, user: { id: 'user_2', name: 'Bob', image: null } },
          ],
          ...extra,
        },
        MemberRole.MEMBER,
      );

    it('throws BadRequestException when creating a direct room with self', async () => {
      await expect(
        service.createDirectRoom('user_1', { targetUserId: 'user_1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new direct room when none exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user_2' });
      prismaMock.room.findUnique.mockResolvedValue(null);
      prismaMock.room.create.mockResolvedValue({ id: 'room_direct_1' });
      prismaMock.roomMember.findUnique.mockResolvedValue(directRoom());

      const res = await service.createDirectRoom('user_1', { targetUserId: 'user_2' });

      expect(prismaMock.room.create).toHaveBeenCalled();
      expect(res.type).toBe(RoomType.DIRECT);
      expect(res.memberCount).toBe(2);
      expect(res.members.map((m) => m.userId)).toEqual(['user_1', 'user_2']);
    });

    it('returns existing direct room if one already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user_2' });
      prismaMock.room.findUnique.mockResolvedValue({ id: 'room_direct_1' });
      prismaMock.roomMember.findUnique.mockResolvedValue(
        directRoom({ preferences: [{ isMuted: true, isArchived: false, isPinned: true }] }),
      );

      const res = await service.createDirectRoom('user_1', { targetUserId: 'user_2' });

      expect(prismaMock.room.create).not.toHaveBeenCalled();
      expect(res.id).toBe('room_direct_1');
      expect(res.preference.isPinned).toBe(true);
    });
  });

  describe('listRooms', () => {
    it('returns sorted rooms belonging to user with pagination', async () => {
      prismaMock.roomMember.findMany.mockResolvedValue([
        {
          userId: 'user_1',
          lastReadMessageId: null,
          joinedAt: now,
          room: {
            id: 'room_1',
            type: RoomType.GROUP,
            name: 'Group 1',
            description: null,
            image: null,
            updatedAt: now,
            preferences: [{ isPinned: false, isArchived: false, isMuted: false }],
            members: [],
            messages: [
              { id: 'msg_1', senderId: 'user_2', body: 'hi', createdAt: now },
            ],
          },
        },
      ]);

      const res = await service.listRooms('user_1', {});

      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.id).toBe('room_1');
      expect(res.items[0]!.lastMessage).toEqual({
        id: 'msg_1',
        senderId: 'user_2',
        body: 'hi',
        createdAt: now.toISOString(),
      });
      expect(res.items[0]!.preference).toEqual({ isMuted: false, isArchived: false, isPinned: false });
      expect(res.items[0]).not.toHaveProperty('preferences');
      expect(res.nextCursor).toBeNull();
    });

    it('filters by isArchived', async () => {
      const room = (id: string, isArchived: boolean) => ({
        userId: 'user_1',
        lastReadMessageId: null,
        joinedAt: now,
        room: {
          id,
          type: RoomType.GROUP,
          name: id,
          description: null,
          image: null,
          updatedAt: now,
          preferences: [{ isPinned: false, isArchived, isMuted: false }],
          members: [],
          messages: [],
        },
      });
      prismaMock.roomMember.findMany.mockResolvedValue([room('a', false), room('b', true)]);

      const res = await service.listRooms('user_1', { isArchived: true });

      expect(res.items.map((r) => r.id)).toEqual(['b']);
    });
  });

  describe('getRoom', () => {
    it('retrieves room details including members for a member', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue(
        membershipWithRoom({
          id: 'room_1',
          type: RoomType.GROUP,
          name: 'General',
          description: 'Official',
          members: [
            { roomId: 'room_1', userId: 'user_1', role: MemberRole.OWNER, joinedAt: now, user: { id: 'user_1', name: 'Alice', image: null } },
          ],
        }),
      );

      const res = await service.getRoom('user_1', 'room_1');

      expect(res.id).toBe('room_1');
      expect(res.memberCount).toBe(1);
      expect(res.members).toEqual([
        {
          roomId: 'room_1',
          userId: 'user_1',
          role: MemberRole.OWNER,
          joinedAt: now.toISOString(),
          user: { id: 'user_1', name: 'Alice', image: null },
        },
      ]);
    });

    it('throws NotFoundException if user is not member of the room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.getRoom('user_1', 'room_unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRoom', () => {
    it('updates group room details for owner/admin', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
        role: MemberRole.OWNER,
        room: { type: RoomType.GROUP },
      });
      prismaMock.room.update.mockResolvedValue({});

      // Mock getRoom response
      vi.spyOn(service, 'getRoom').mockResolvedValue({
        id: 'room_1',
        type: RoomType.GROUP,
        name: 'Updated Name',
        description: null,
        image: null,
        memberCount: 1,
        lastMessage: null,
        unreadCount: 0,
        preference: { isMuted: false, isArchived: false, isPinned: false },
        updatedAt: now.toISOString(),
        members: [],
      });

      const res = await service.updateRoom('user_1', 'room_1', {
        name: 'Updated Name',
      });

      expect(prismaMock.room.update).toHaveBeenCalledWith({
        where: { id: 'room_1' },
        data: { name: 'Updated Name' },
      });
      expect(res.name).toBe('Updated Name');
    });

    it('throws BadRequestException when updating a direct room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
        role: MemberRole.MEMBER,
        room: { type: RoomType.DIRECT },
      });

      await expect(
        service.updateRoom('user_1', 'room_direct', { name: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRoom', () => {
    it('deletes group room when caller is OWNER', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
        role: MemberRole.OWNER,
        room: { type: RoomType.GROUP },
      });
      prismaMock.room.delete.mockResolvedValue({});

      await service.deleteRoom('user_1', 'room_1');

      expect(prismaMock.room.delete).toHaveBeenCalledWith({
        where: { id: 'room_1' },
      });
    });

    it('throws ForbiddenException when caller is not OWNER', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_2',
        role: MemberRole.ADMIN,
        room: { type: RoomType.GROUP },
      });

      await expect(service.deleteRoom('user_2', 'room_1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('member management', () => {
    it('listMembers returns members in API shape', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
      });
      prismaMock.roomMember.findMany.mockResolvedValue([
        {
          roomId: 'room_1',
          userId: 'user_1',
          role: MemberRole.OWNER,
          joinedAt: now,
          user: { id: 'user_1', name: 'Alice', image: null },
        },
        {
          roomId: 'room_1',
          userId: 'user_2',
          role: MemberRole.MEMBER,
          joinedAt: now,
          user: { id: 'user_2', name: 'Bob', image: null },
        },
      ]);

      const res = await service.listMembers('user_1', 'room_1');

      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({
        roomId: 'room_1',
        userId: 'user_1',
        role: MemberRole.OWNER,
        joinedAt: now.toISOString(),
        user: { id: 'user_1', name: 'Alice', image: null },
      });
      expect(res[1]!.user.name).toBe('Bob');
      expect(res[1]).not.toHaveProperty('isOnline');
    });

    it('addMembers adds new users into group room', async () => {
      // 1st lookup: the caller's membership; 2nd: the membership row just created.
      prismaMock.roomMember.findUnique
        .mockResolvedValueOnce({
          userId: 'user_1',
          role: MemberRole.OWNER,
          room: { type: RoomType.GROUP },
        })
        .mockResolvedValueOnce({
          roomId: 'room_1',
          userId: 'user_2',
          role: MemberRole.MEMBER,
          joinedAt: now,
          user: { id: 'user_2', name: 'Bob', image: null },
        });
      prismaMock.roomMember.createMany.mockResolvedValue({ count: 1 });
      prismaMock.roomMember.findMany.mockResolvedValue([
        { userId: 'user_1' },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user_2', name: 'Bob', image: null },
      ]);

      const res = await service.addMembers('user_1', 'room_1', {
        userIds: ['user_2'],
      });

      expect(prismaMock.roomMember.createMany).toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        roomId: 'room_1',
        userId: 'user_2',
        role: MemberRole.MEMBER,
        user: { id: 'user_2', name: 'Bob', image: null },
      });
    });

    it('updateMemberRole updates role of another member', async () => {
      prismaMock.roomMember.findUnique
        .mockResolvedValueOnce({
          userId: 'user_1',
          role: MemberRole.OWNER,
          room: { type: RoomType.GROUP },
        })
        .mockResolvedValueOnce({
          userId: 'user_2',
          role: MemberRole.MEMBER,
        });

      prismaMock.roomMember.update.mockResolvedValue({
        roomId: 'room_1',
        userId: 'user_2',
        role: MemberRole.ADMIN,
        joinedAt: now,
        user: { id: 'user_2', name: 'Bob', image: null },
      });

      const res = await service.updateMemberRole(
        'user_1',
        'room_1',
        'user_2',
        { role: MemberRole.ADMIN },
      );

      expect(res.role).toBe(MemberRole.ADMIN);
      expect(res.userId).toBe('user_2');
      expect(res.roomId).toBe('room_1');
    });

    it('removeMember prevents removing the OWNER', async () => {
      prismaMock.roomMember.findUnique
        .mockResolvedValueOnce({
          userId: 'user_1',
          role: MemberRole.OWNER,
          room: { type: RoomType.GROUP },
        })
        .mockResolvedValueOnce({
          userId: 'user_1',
          role: MemberRole.OWNER,
        });

      await expect(
        service.removeMember('user_1', 'room_1', 'user_1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePreferences & markRead', () => {
    it('updatePreferences upserts preferences', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.roomPreference.upsert.mockResolvedValue({
        isMuted: true,
        isArchived: false,
        isPinned: true,
      });

      const res = await service.updatePreferences('user_1', 'room_1', {
        isMuted: true,
        isPinned: true,
      });

      expect(res).toEqual({
        roomId: 'room_1',
        userId: 'user_1',
        isMuted: true,
        isArchived: false,
        isPinned: true,
      });
    });

    it('markRead updates lastReadMessageId and upserts receipt', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg_1',
        roomId: 'room_1',
        createdAt: now,
      });

      const res = await service.markRead('user_1', 'room_1', {
        messageId: 'msg_1',
      });

      expect(prismaMock.roomMember.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room_1', userId: 'user_1' } },
        data: { lastReadMessageId: 'msg_1' },
      });
      expect(prismaMock.messageReceipt.upsert).toHaveBeenCalled();
      expect(res.roomId).toBe('room_1');
      expect(res.userId).toBe('user_1');
      expect(res.lastReadMessageId).toBe('msg_1');
      expect(typeof res.readAt).toBe('string');
      expect(Number.isNaN(Date.parse(res.readAt))).toBe(false);
    });
  });
});