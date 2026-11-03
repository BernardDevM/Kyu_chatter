
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';

import { RoomMemberGuard } from '../common/guards/room-member.guard.js';
import { RoomAdminGuard } from '../common/guards/room-admin.guard.js';
import { RoomOwnerGuard } from '../common/guards/room-owner.guard.js';

import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    AuthModule,
    ChatModule,
  ],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomMemberGuard,
    RoomAdminGuard,
    RoomOwnerGuard,
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
