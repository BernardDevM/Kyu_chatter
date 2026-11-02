import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('RoomsController', () => {
  let controller: RoomsController;
  let roomsServiceMock: any;

  beforeEach(async () => {
    roomsServiceMock = {
      createGroupRoom: vi.fn(),
      createDirectRoom: vi.fn(),
      listRooms: vi.fn(),
      getRoom: vi.fn(),
      updateRoom: vi.fn(),
      deleteRoom: vi.fn(),
      listMembers: vi.fn(),
      addMembers: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      leaveRoom: vi.fn(),
      updatePreferences: vi.fn(),
      markRead: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        { provide: RoomsService, useValue: roomsServiceMock },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
