import { Test, TestingModule } from '@nestjs/testing';
import { RoomMessagesController } from './room-messages.controller.js';
import { MessagesService } from './messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('RoomMessagesController', () => {
  let controller: RoomMessagesController;
  let messagesServiceMock: any;

  beforeEach(async () => {
    messagesServiceMock = {
      syncMessages: vi.fn(),
      listMessages: vi.fn(),
      sendMessage: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomMessagesController],
      providers: [
        { provide: MessagesService, useValue: messagesServiceMock },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<RoomMessagesController>(RoomMessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
