import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptStatus } from '../generated/prisma/enums.js';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaMock: any;

  const now = new Date('2026-01-01T00:00:00.000Z');
  const sampleMessage = {
    id: 'msg_1',
    roomId: 'room_1',
    senderId: 'user_1',
    clientMessageId: 'cli_msg_1',
    body: 'Hello world',
    replyToId: null,
    nodeId: 'node-1',
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    sender: { id: 'user_1', name: 'Alice', image: null },
    replyTo: null,
    attachments: [],
    reactions: [],
  };

  beforeEach(async () => {
    prismaMock = {
      message: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      room: {
        update: vi.fn(),
      },
      roomMember: {
        findUnique: vi.fn(),
      },
      media: {
        count: vi.fn(),
      },
      messageReaction: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
      },
      messageReceipt: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncMessages', () => {
    it('returns newer messages in chronological order', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg_anchor',
        roomId: 'room_1',
        createdAt: now,
      });
      prismaMock.message.findMany.mockResolvedValue([sampleMessage]);

      const res = await service.syncMessages('user_1', 'room_1', {
        afterId: 'msg_anchor',
        limit: 10,
      });

      expect(res).toHaveLength(1);
      expect(res[0]!.id).toBe('msg_1');
      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room_1', createdAt: { gt: now } },
        take: 10,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: expect.any(Object),
      });
    });

    it('throws ForbiddenException if user is not in room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.syncMessages('user_1', 'room_1', { afterId: 'msg_anchor' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if anchor message does not exist in room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique.mockResolvedValue(null);

      await expect(
        service.syncMessages('user_1', 'room_1', { afterId: 'msg_unknown' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMessages', () => {
    it('returns newest messages with pagination nextCursor', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findMany.mockResolvedValue([
        sampleMessage,
        { ...sampleMessage, id: 'msg_2' },
      ]);

      const res = await service.listMessages('user_1', 'room_1', { limit: 1 });

      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.id).toBe('msg_1');
      expect(res.nextCursor).toBe('msg_1');
    });

    it('throws ForbiddenException if user is not in room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.listMessages('user_1', 'room_1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    it('creates message and updates room updatedAt', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue(sampleMessage);
      prismaMock.room.update.mockResolvedValue({});

      const res = await service.sendMessage('user_1', 'room_1', {
        clientMessageId: 'cli_msg_1',
        body: 'Hello world',
      });

      expect(prismaMock.message.create).toHaveBeenCalled();
      expect(prismaMock.room.update).toHaveBeenCalledWith({
        where: { id: 'room_1' },
        data: { updatedAt: expect.any(Date) },
      });
      expect(res.id).toBe('msg_1');
      expect(res.body).toBe('Hello world');
    });

    it('returns existing message if clientMessageId is already sent (idempotency)', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique.mockResolvedValue(sampleMessage);

      const res = await service.sendMessage('user_1', 'room_1', {
        clientMessageId: 'cli_msg_1',
        body: 'Hello world',
      });

      expect(prismaMock.message.create).not.toHaveBeenCalled();
      expect(res.id).toBe('msg_1');
    });

    it('throws BadRequestException if replyTo message is not in room', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.message.findUnique
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce({ id: 'msg_parent', roomId: 'other_room' }); // replyTo check

      await expect(
        service.sendMessage('user_1', 'room_1', {
          clientMessageId: 'cli_msg_2',
          body: 'Reply test',
          replyToId: 'msg_parent',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('editMessage', () => {
    it('updates message body and returns updated response', async () => {
      prismaMock.message.findUnique.mockResolvedValue(sampleMessage);
      prismaMock.message.update.mockResolvedValue({
        ...sampleMessage,
        body: 'Edited content',
        editedAt: now,
      });

      const res = await service.editMessage('user_1', 'msg_1', {
        body: 'Edited content',
      });

      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: 'msg_1' },
        data: { body: 'Edited content', editedAt: expect.any(Date) },
        include: expect.any(Object),
      });
      expect(res.body).toBe('Edited content');
    });

    it('throws ForbiddenException if caller is not the sender', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        ...sampleMessage,
        senderId: 'user_other',
      });

      await expect(
        service.editMessage('user_1', 'msg_1', { body: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if message was deleted', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        ...sampleMessage,
        deletedAt: now,
      });

      await expect(
        service.editMessage('user_1', 'msg_1', { body: 'New' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMessage', () => {
    it('soft deletes message by setting deletedAt', async () => {
      prismaMock.message.findUnique.mockResolvedValue(sampleMessage);
      prismaMock.message.update.mockResolvedValue({});

      await service.deleteMessage('user_1', 'msg_1');

      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: 'msg_1' },
        data: { deletedAt: expect.any(Date), body: null },
      });
    });

    it('throws ForbiddenException if non-sender deletes message', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        ...sampleMessage,
        senderId: 'user_2',
      });

      await expect(service.deleteMessage('user_1', 'msg_1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reactions', () => {
    it('addReaction upserts reaction and returns summary', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg_1',
        roomId: 'room_1',
      });
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.messageReaction.upsert.mockResolvedValue({});
      prismaMock.messageReaction.findMany.mockResolvedValue([
        { emoji: '👍', userId: 'user_1' },
        { emoji: '👍', userId: 'user_2' },
      ]);

      const res = await service.addReaction('user_1', 'msg_1', { emoji: '👍' });

      expect(prismaMock.messageReaction.upsert).toHaveBeenCalled();
      expect(res).toEqual([{ emoji: '👍', count: 2, reactedByMe: true }]);
    });

    it('removeReaction deletes reaction and returns summary', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg_1',
        roomId: 'room_1',
      });
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.messageReaction.deleteMany.mockResolvedValue({});
      prismaMock.messageReaction.findMany.mockResolvedValue([]);

      const res = await service.removeReaction('user_1', 'msg_1', {
        emoji: '👍',
      });

      expect(prismaMock.messageReaction.deleteMany).toHaveBeenCalled();
      expect(res).toEqual([]);
    });
  });

  describe('getReceipts', () => {
    it('returns delivery and read receipts for room member', async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: 'msg_1',
        roomId: 'room_1',
      });
      prismaMock.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prismaMock.messageReceipt.findMany.mockResolvedValue([
        {
          userId: 'user_2',
          status: ReceiptStatus.READ,
          deliveredAt: now,
          readAt: now,
        },
      ]);

      const res = await service.getReceipts('user_1', 'msg_1');

      expect(res).toHaveLength(1);
      expect(res[0]!.userId).toBe('user_2');
      expect(res[0]!.status).toBe(ReceiptStatus.READ);
    });
  });
});
