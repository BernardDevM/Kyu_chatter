import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';
import { TypingService } from './typing.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../realtime/redis.service.js';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let presenceServiceMock: any;
  let typingServiceMock: any;
  let messagesServiceMock: any;
  let prismaMock: any;
  let redisServiceMock: any;

  beforeEach(async () => {
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
      roomMember: { update: vi.fn() },
      messageReceipt: { upsert: vi.fn() },
    };
    redisServiceMock = {
      isReady: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockReturnValue({}),
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
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
