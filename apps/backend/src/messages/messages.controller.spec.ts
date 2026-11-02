import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

describe('MessagesController', () => {
  let controller: MessagesController;
  let messagesServiceMock: any;

  beforeEach(async () => {
    messagesServiceMock = {
      editMessage: vi.fn(),
      deleteMessage: vi.fn(),
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      getReceipts: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: messagesServiceMock },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
