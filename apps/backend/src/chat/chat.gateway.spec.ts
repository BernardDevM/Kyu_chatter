import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Socket, Server } from 'socket.io';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';
import { TypingService } from './typing.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../realtime/redis.service.js';
import type { SocketUser } from '../common/utils/socket-user.util.js';

interface MockSocket {
  id: string;
  data: { user?: SocketUser };
  handshake: {
    headers: Record<string, string>;
    auth: Record<string, unknown>;
  };
  rooms: Set<string>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
}

describe('ChatGateway', () => {
  const originalEnv = process.env;
  let gateway: ChatGateway;
  let presenceServiceMock: {
    addConnection: ReturnType<typeof vi.fn>;
    removeConnection: ReturnType<typeof vi.fn>;
    heartbeat: ReturnType<typeof vi.fn>;
  };
  let typingServiceMock: {
    setTyping: ReturnType<typeof vi.fn>;
    removeTyping: ReturnType<typeof vi.fn>;
  };
  let messagesServiceMock: {
    sendMessage: ReturnType<typeof vi.fn>;
    syncMessages: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
  };
  let prismaMock: {
    roomMember: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    messageReceipt: {
      upsert: ReturnType<typeof vi.fn>;
    };
  };
  let redisServiceMock: {
    isReady: ReturnType<typeof vi.fn>;
    getClient: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
  };
  let serverMock: {
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  function createMockSocket(
    user?: SocketUser,
    rooms: string[] = [],
    handshake: { headers?: Record<string, string>; auth?: Record<string, unknown> } = {},
  ): MockSocket {
    const toRoomEmitter = {
      emit: vi.fn(),
    };
    return {
      id: 'socket-test-1',
      data: user ? { user } : {},
      handshake: {
        headers: handshake.headers ?? {},
        auth: handshake.auth ?? {},
      },
      rooms: new Set(rooms),
      emit: vi.fn(),
      disconnect: vi.fn(),
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      to: vi.fn().mockReturnValue(toRoomEmitter),
    };
  }

  beforeEach(async () => {
    process.env = { ...originalEnv };

    presenceServiceMock = {
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      heartbeat: vi.fn(),
    };
    typingServiceMock = {
      setTyping: vi.fn(),
      removeTyping: vi.fn(),
    };
    messagesServiceMock = {
      sendMessage: vi.fn(),
      syncMessages: vi.fn(),
      listMessages: vi.fn(),
    };
    prismaMock = {
      roomMember: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      messageReceipt: {
        upsert: vi.fn(),
      },
    };
    redisServiceMock = {
      isReady: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockReturnValue({}),
      pipeline: vi.fn(),
    };

    const serverRoomEmitter = {
      emit: vi.fn(),
    };
    serverMock = {
      to: vi.fn().mockReturnValue(serverRoomEmitter),
      emit: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: PresenceService, useValue: presenceServiceMock },
        { provide: TypingService, useValue: typingServiceMock },
        { provide: MessagesService, useValue: messagesServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = serverMock as unknown as Server;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('disconnects unauthenticated socket without registering presence', async () => {
      process.env.ALLOW_DEV_USER_HEADER = 'false';
      const socket = createMockSocket();

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(presenceServiceMock.addConnection).not.toHaveBeenCalled();
    });

    it('disconnects dev identity in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_USER_HEADER = 'true';
      const socket = createMockSocket(undefined, [], {
        headers: { 'x-dev-user-id': 'dev-user-1' },
      });

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(presenceServiceMock.addConnection).not.toHaveBeenCalled();
    });

    it('authenticates dev identity in development mode when allowed and broadcasts presence', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_USER_HEADER = 'true';
      const socket = createMockSocket(undefined, [], {
        headers: { 'x-dev-user-id': 'dev-user-1' },
      });

      presenceServiceMock.addConnection.mockResolvedValue(true);
      prismaMock.roomMember.findMany.mockResolvedValue([
        { roomId: 'room-1' },
        { roomId: 'room-2' },
      ]);

      await gateway.handleConnection(socket as unknown as Socket);

      expect(socket.data.user).toBeDefined();
      expect(socket.data.user?.id).toBe('dev-user-1');
      expect(presenceServiceMock.addConnection).toHaveBeenCalledWith('dev-user-1', socket.id);
      expect(serverMock.to).toHaveBeenCalledWith(['room-1', 'room-2']);
    });
  });

  describe('handleJoinRoom', () => {
    it('rejects unauthenticated socket with UNAUTHORIZED ack error', async () => {
      const socket = createMockSocket();
      const result = await gateway.handleJoinRoom(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(result).toEqual({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        error: 'Authentication required',
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects non-member with FORBIDDEN ack error', async () => {
      const user: SocketUser = { id: 'usr-1', email: 'test@example.com', name: 'Test' };
      const socket = createMockSocket(user);
      prismaMock.roomMember.findUnique.mockResolvedValue(null);

      const result = await gateway.handleJoinRoom(socket as unknown as Socket, {
        roomId: 'room-private',
      });

      expect(prismaMock.roomMember.findUnique).toHaveBeenCalledWith({
        where: {
          roomId_userId: {
            roomId: 'room-private',
            userId: 'usr-1',
          },
        },
        select: { roomId: true },
      });
      expect(result).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You are not a member of this room',
        error: 'You are not a member of this room',
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins member to socket room and returns ok: true', async () => {
      const user: SocketUser = { id: 'usr-1', email: 'test@example.com', name: 'Test' };
      const socket = createMockSocket(user);
      prismaMock.roomMember.findUnique.mockResolvedValue({ roomId: 'room-1' });

      const result = await gateway.handleJoinRoom(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(socket.join).toHaveBeenCalledWith('room-1');
      expect(result).toEqual({ ok: true, roomId: 'room-1' });
    });
  });

  describe('handleTypingStart & handleTypingStop', () => {
    const user: SocketUser = { id: 'usr-1', email: 'test@example.com', name: 'Test' };

    it('rejects typing:start if socket has not joined room', async () => {
      const socket = createMockSocket(user, []); // not in 'room-1'

      const result = await gateway.handleTypingStart(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(result).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before sending typing indicators',
        error: 'You must join the room before sending typing indicators',
      });
      expect(typingServiceMock.setTyping).not.toHaveBeenCalled();
    });

    it('allows typing:start when socket has joined room', async () => {
      const socket = createMockSocket(user, ['room-1']);

      const result = await gateway.handleTypingStart(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(result).toEqual({ ok: true });
      expect(typingServiceMock.setTyping).toHaveBeenCalledWith('room-1', 'usr-1');
    });

    it('rejects typing:stop if socket has not joined room', async () => {
      const socket = createMockSocket(user, []);

      const result = await gateway.handleTypingStop(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(result).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before sending typing indicators',
        error: 'You must join the room before sending typing indicators',
      });
      expect(typingServiceMock.removeTyping).not.toHaveBeenCalled();
    });

    it('allows typing:stop when socket has joined room', async () => {
      const socket = createMockSocket(user, ['room-1']);

      const result = await gateway.handleTypingStop(socket as unknown as Socket, {
        roomId: 'room-1',
      });

      expect(result).toEqual({ ok: true });
      expect(typingServiceMock.removeTyping).toHaveBeenCalledWith('room-1', 'usr-1');
    });
  });

  describe('handleMarkRead', () => {
    const user: SocketUser = { id: 'usr-1', email: 'test@example.com', name: 'Test' };

    it('rejects message:read if socket has not joined room', async () => {
      const socket = createMockSocket(user, []);

      const result = await gateway.handleMarkRead(socket as unknown as Socket, {
        roomId: 'room-1',
        messageId: 'msg-1',
      });

      expect(result).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must join the room before marking messages as read',
        error: 'You must join the room before marking messages as read',
      });
      expect(prismaMock.roomMember.update).not.toHaveBeenCalled();
    });

    it('allows message:read when socket has joined room and logs warning on DB error', async () => {
      const socket = createMockSocket(user, ['room-1']);
      prismaMock.roomMember.update.mockRejectedValue(new Error('DB failure'));

      const result = await gateway.handleMarkRead(socket as unknown as Socket, {
        roomId: 'room-1',
        messageId: 'msg-1',
      });

      expect(result).toEqual({ ok: true });
      expect(prismaMock.roomMember.update).toHaveBeenCalled();
    });
  });
});
