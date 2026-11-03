import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagesService } from '../../src/messages/messages.service.js';
import { RoomMessagesController } from '../../src/messages/room-messages.controller.js';
import { RoomsController } from '../../src/rooms/rooms.controller.js';
import { WS_SERVER_EVENTS } from '../../src/chat/chat.events.js';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('REST handlers broadcast realtime events', () => {
  let realtime: { toRoom: ReturnType<typeof vi.fn>; evictUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    realtime = { toRoom: vi.fn(), evictUser: vi.fn().mockResolvedValue(undefined) };
  });

  describe('MessagesService', () => {
    let prisma: any;
    let service: MessagesService;

    beforeEach(() => {
      prisma = {
        message: { findUnique: vi.fn(), update: vi.fn() },
        roomMember: { findUnique: vi.fn() },
        messageReaction: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
      };
      service = new MessagesService(prisma, realtime as any);
    });

    it('editMessage emits message:updated with viewer-neutral reactions', async () => {
      prisma.message.findUnique.mockResolvedValue({ id: 'msg_1', senderId: 'user_1', deletedAt: null });
      prisma.message.update.mockResolvedValue({
        id: 'msg_1',
        roomId: 'room_1',
        senderId: 'user_1',
        clientMessageId: 'c1',
        body: 'edited',
        replyToId: null,
        nodeId: 'node-1',
        createdAt: now,
        editedAt: now,
        deletedAt: null,
        sender: { id: 'user_1', name: 'Alice', image: null },
        replyTo: null,
        attachments: [],
        reactions: [{ emoji: '👍', userId: 'user_1' }],
      });

      const res = await service.editMessage('user_1', 'msg_1', { body: 'edited' });

      expect(realtime.toRoom).toHaveBeenCalledTimes(1);
      const [roomId, event, payload] = realtime.toRoom.mock.calls[0]!;
      expect(roomId).toBe('room_1');
      expect(event).toBe(WS_SERVER_EVENTS.MESSAGE_UPDATED);
      expect(payload.id).toBe('msg_1');
      expect(payload.body).toBe('edited');
      expect(payload.reactions).toHaveLength(1);
      expect(payload.reactions[0].hasReacted ?? false).toBe(false);
      expect(payload.reactions[0].reactedByMe ?? false).toBe(false);
      // the REST caller still gets their own view
      expect(res.reactions[0]!.hasReacted ?? res.reactions[0]!.reactedByMe).toBe(true);
    });

    it('deleteMessage emits message:deleted with ids only', async () => {
      prisma.message.findUnique.mockResolvedValue({ id: 'msg_1', roomId: 'room_1', senderId: 'user_1' });
      prisma.message.update.mockResolvedValue({});

      await service.deleteMessage('user_1', 'msg_1');

      expect(realtime.toRoom).toHaveBeenCalledWith('room_1', WS_SERVER_EVENTS.MESSAGE_DELETED, {
        messageId: 'msg_1',
        roomId: 'room_1',
      });
    });

    it('does not emit when the delete is rejected', async () => {
      prisma.message.findUnique.mockResolvedValue({ id: 'msg_1', roomId: 'room_1', senderId: 'someone_else' });
      prisma.roomMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

      await expect(service.deleteMessage('user_1', 'msg_1')).rejects.toThrow();

      expect(realtime.toRoom).not.toHaveBeenCalled();
    });

    it.each([
      ['addReaction', (s: MessagesService) => s.addReaction('user_1', 'msg_1', { emoji: '👍' })],
      ['removeReaction', (s: MessagesService) => s.removeReaction('user_1', 'msg_1', { emoji: '👍' })],
    ])('%s emits reaction:updated to the message room', async (_name, call) => {
      prisma.message.findUnique.mockResolvedValue({ id: 'msg_1', roomId: 'room_1' });
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'user_1' });
      prisma.messageReaction.findMany.mockResolvedValue([{ emoji: '👍', userId: 'user_1' }]);

      const res = await call(service);

      expect(res).toHaveLength(1);
      expect(realtime.toRoom).toHaveBeenCalledTimes(1);
      const [roomId, event, payload] = realtime.toRoom.mock.calls[0]!;
      expect(roomId).toBe('room_1');
      expect(event).toBe(WS_SERVER_EVENTS.REACTION_UPDATED);
      expect(payload.messageId).toBe('msg_1');
      expect(payload.reactions).toHaveLength(1);
      expect(payload.reactions[0]).toMatchObject({ emoji: '👍', count: 1 });
      expect(payload.reactions[0].hasReacted ?? false).toBe(false);
      expect(payload.reactions[0].reactedByMe ?? false).toBe(false);
    });

    it('works without an emitter (e.g. in isolated tests)', async () => {
      const bare = new MessagesService(prisma);
      prisma.message.findUnique.mockResolvedValue({ id: 'msg_1', roomId: 'room_1', senderId: 'user_1' });
      prisma.message.update.mockResolvedValue({});

      await expect(bare.deleteMessage('user_1', 'msg_1')).resolves.toBeUndefined();
    });
  });

  describe('RoomMessagesController.sendMessage', () => {
    it('broadcasts message:new just like the WebSocket handler', async () => {
      const message = { id: 'msg_1', roomId: 'room_1', clientMessageId: 'c1' };
      const messages = { sendMessage: vi.fn().mockResolvedValue(message) };
      const controller = new RoomMessagesController(messages as any, realtime as any);

      const res = await controller.sendMessage('user_1', { roomId: 'room_1' } as any, {
        clientMessageId: 'c1',
        body: 'hi',
      } as any);

      expect(res).toBe(message);
      expect(realtime.toRoom).toHaveBeenCalledWith('room_1', WS_SERVER_EVENTS.MESSAGE_NEW, message);
    });

    it('does not broadcast when the send fails', async () => {
      const messages = { sendMessage: vi.fn().mockRejectedValue(new Error('nope')) };
      const controller = new RoomMessagesController(messages as any, realtime as any);

      await expect(
        controller.sendMessage('user_1', { roomId: 'room_1' } as any, {} as any),
      ).rejects.toThrow('nope');
      expect(realtime.toRoom).not.toHaveBeenCalled();
    });
  });

  describe('RoomsController', () => {
    let rooms: Record<string, ReturnType<typeof vi.fn>>;
    let controller: RoomsController;

    beforeEach(() => {
      rooms = {
        updateRoom: vi.fn(),
        addMembers: vi.fn(),
        removeMember: vi.fn().mockResolvedValue(undefined),
        leaveRoom: vi.fn().mockResolvedValue(undefined),
      };
      controller = new RoomsController(rooms as any, realtime as any);
    });

    it("updateRoom emits room:updated without the caller's personal state", async () => {
      const detail = {
        id: 'room_1',
        name: 'Renamed',
        unreadCount: 4,
        preference: { isMuted: true, isArchived: false, isPinned: true },
      };
      rooms.updateRoom!.mockResolvedValue(detail);

      const res = await controller.updateRoom('user_1', { roomId: 'room_1' } as any, { name: 'Renamed' } as any);

      expect(res).toBe(detail);
      const [roomId, event, payload] = realtime.toRoom.mock.calls[0]!;
      expect(roomId).toBe('room_1');
      expect(event).toBe(WS_SERVER_EVENTS.ROOM_UPDATED);
      expect(payload).toMatchObject({ id: 'room_1', name: 'Renamed', unreadCount: 0 });
      expect(payload.preference).toEqual({ isMuted: false, isArchived: false, isPinned: false });
    });

    it('addMembers emits one member:joined per added user', async () => {
      rooms.addMembers!.mockResolvedValue([
        { user: { id: 'user_2' } },
        { user: { id: 'user_3' } },
      ]);

      await controller.addMembers('user_1', { roomId: 'room_1' } as any, { userIds: ['user_2', 'user_3'] } as any);

      expect(realtime.toRoom.mock.calls).toEqual([
        ['room_1', WS_SERVER_EVENTS.MEMBER_JOINED, { roomId: 'room_1', userId: 'user_2' }],
        ['room_1', WS_SERVER_EVENTS.MEMBER_JOINED, { roomId: 'room_1', userId: 'user_3' }],
      ]);
    });

    it('addMembers emits nothing when nobody new was added', async () => {
      rooms.addMembers!.mockResolvedValue([]);

      await controller.addMembers('user_1', { roomId: 'room_1' } as any, { userIds: ['user_2'] } as any);

      expect(realtime.toRoom).not.toHaveBeenCalled();
    });

    it('removeMember announces member:left for the removed user, then evicts their sockets', async () => {
      await controller.removeMember('user_1', { roomId: 'room_1', userId: 'user_2' } as any);

      expect(realtime.toRoom).toHaveBeenCalledWith('room_1', WS_SERVER_EVENTS.MEMBER_LEFT, {
        roomId: 'room_1',
        userId: 'user_2',
      });
      expect(realtime.evictUser).toHaveBeenCalledWith('room_1', 'user_2');
      expect(realtime.toRoom.mock.invocationCallOrder[0]!).toBeLessThan(
        realtime.evictUser.mock.invocationCallOrder[0]!,
      );
    });

    it('leaveRoom announces the caller as the one who left', async () => {
      await controller.leaveRoom('user_9', { roomId: 'room_1' } as any);

      expect(realtime.toRoom).toHaveBeenCalledWith('room_1', WS_SERVER_EVENTS.MEMBER_LEFT, {
        roomId: 'room_1',
        userId: 'user_9',
      });
      expect(realtime.evictUser).toHaveBeenCalledWith('room_1', 'user_9');
    });

    it('does not announce anything when the removal is rejected', async () => {
      rooms.removeMember!.mockRejectedValue(new Error('forbidden'));

      await expect(
        controller.removeMember('user_1', { roomId: 'room_1', userId: 'user_2' } as any),
      ).rejects.toThrow('forbidden');
      expect(realtime.toRoom).not.toHaveBeenCalled();
      expect(realtime.evictUser).not.toHaveBeenCalled();
    });
  });
});
