import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AuthGuard,
} from '@thallesp/nestjs-better-auth';
import { RoomMemberGuard } from '../common/guards/room-member.guard.js';
import { RoomAdminGuard } from '../common/guards/room-admin.guard.js';
import { RoomOwnerGuard } from '../common/guards/room-owner.guard.js';

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
      providers: [{ provide: RoomsService, useValue: roomsServiceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoomAdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoomMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoomOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RoomsController>(RoomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
