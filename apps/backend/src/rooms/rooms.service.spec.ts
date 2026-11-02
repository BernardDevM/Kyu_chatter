import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresenceService } from '../chat/presence.service.js';
import { MemberRole, RoomType } from '../generated/prisma/enums.js';

describe('RoomsService', () => {
  let service: RoomsService;
  let prismaMock: any;
  let presenceMock: any;

  const now = new Date('2026-01-01T00:00:00.000Z');

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

    presenceMock = {
      getPresence: vi.fn().mockResolvedValue({
        presence: {
          user_1: { online: true, lastSeenAt: null },
          user_2: { online: false, lastSeenAt: now.toISOString() },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PresenceService, useValue: presenceMock },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGroupRoom', () => {
    it('creates a group room and assigns creator as OWNER', async () => {
      prismaMock.room.create.mockResolvedValue({
        id: 'room_1',
        type: RoomType.GROUP,
        name: 'Cool Group',
        description: 'A test group',
        image: null,
        createdById: 'user_1',
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.createGroupRoom('user_1', {
        name: 'Cool Group',
        description: 'A test group',
        memberIds: ['user_2', 'user_3'],
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
      });
      expect(res.id).toBe('room_1');
      expect(res.myRole).toBe(MemberRole.OWNER);
      expect(res.memberCount).toBe(3);
    });
  });

  describe('createDirectRoom', () => {
    it('throws BadRequestException when creating a direct room with self', async () => {
      await expect(
        service.createDirectRoom('user_1', { userId: 'user_1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new direct room when none exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Bob',
        image: null,
      });
      prismaMock.room.findUnique.mockResolvedValue(null);

      const createdRoom = {
        id: 'room_direct_1',
        type: RoomType.DIRECT,
        directKey: 'user_1:user_2',
        createdById: 'user_1',
        createdAt: now,
        updatedAt: now,
        members: [
          { userId: 'user_1', role: MemberRole.MEMBER, user: { id: 'user_1', name: 'Alice', image: null } },
          { userId: 'user_2', role: MemberRole.MEMBER, user: { id: 'user_2', name: 'Bob', image: null } },
        ],
        preferences: [],
        messages: [],
      };

      prismaMock.room.create.mockResolvedValue(createdRoom);
      prismaMock.room.findUniqueOrThrow.mockResolvedValue(createdRoom);

      const res = await service.createDirectRoom('user_1', { userId: 'user_2' });

      expect(res.type).toBe(RoomType.DIRECT);
      expect(res.otherUser?.id).toBe('user_2');
      expect(res.directKey).toBe('user_1:user_2');
    });

    it('returns existing direct room if one already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Bob',
        image: null,
      });

      const existingRoom = {
        id: 'room_direct_existing',
        type: RoomType.DIRECT,
        directKey: 'user_1:user_2',
        createdById: 'user_1',
        createdAt: now,
        updatedAt: now,
        members: [
          { userId: 'user_1', role: MemberRole.MEMBER, user: { id: 'user_1', name: 'Alice', image: null } },
          { userId: 'user_2', role: MemberRole.MEMBER, user: { id: 'user_2', name: 'Bob', image: null } },
        ],
        preferences: [{ isMuted: true, isArchived: false, isPinned: true }],
        messages: [],
      };

      prismaMock.room.findUnique.mockResolvedValue(existingRoom);

      const res = await service.createDirectRoom('user_1', { userId: 'user_2' });

      expect(prismaMock.room.create).not.toHaveBeenCalled();
      expect(res.id).toBe('room_direct_existing');
      expect(res.preferences.isPinned).toBe(true);
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
            messages: [],
          },
        },
      ]);

      const res = await service.listRooms('user_1', {});

      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.id).toBe('room_1');
      expect(res.nextCursor).toBeNull();
    });
  });

  describe('getRoom', () => {
    it('retrieves room details for member', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
        role: MemberRole.OWNER,
        lastReadMessageId: null,
        joinedAt: now,
        room: {
          id: 'room_1',
          type: RoomType.GROUP,
          name: 'General',
          description: 'Official',
          image: null,
          directKey: null,
          createdById: 'user_1',
          createdAt: now,
          updatedAt: now,
          preferences: [],
          members: [
            { userId: 'user_1', user: { id: 'user_1', name: 'Alice', image: null } },
          ],
          messages: [],
        },
      });

      const res = await service.getRoom('user_1', 'room_1');

      expect(res.id).toBe('room_1');
      expect(res.myRole).toBe(MemberRole.OWNER);
      expect(res.memberCount).toBe(1);
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
        lastMessage: null,
        unreadCount: 0,
        preferences: { isMuted: false, isArchived: false, isPinned: false },
        directKey: null,
        createdById: 'user_1',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        myRole: MemberRole.OWNER,
        memberCount: 1,
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
    it('listMembers returns members with presence status', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
      });
      prismaMock.roomMember.findMany.mockResolvedValue([
        {
          userId: 'user_1',
          role: MemberRole.OWNER,
          joinedAt: now,
          user: { id: 'user_1', name: 'Alice', image: null },
        },
        {
          userId: 'user_2',
          role: MemberRole.MEMBER,
          joinedAt: now,
          user: { id: 'user_2', name: 'Bob', image: null },
        },
      ]);

      const res = await service.listMembers('user_1', 'room_1');

      expect(res).toHaveLength(2);
      expect(res[0]!.user.name).toBe('Alice');
      expect(res[0]!.isOnline).toBe(true);
      expect(res[1]!.user.name).toBe('Bob');
      expect(res[1]!.isOnline).toBe(false);
    });

    it('addMembers adds new users into group room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({
        userId: 'user_1',
        role: MemberRole.OWNER,
        room: { type: RoomType.GROUP },
      });
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
      expect(res[0]!.user.id).toBe('user_2');
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
      expect(res.lastReadMessageId).toBe('msg_1');
      expect(res.unreadCount).toBe(0);
    });
  });
});
