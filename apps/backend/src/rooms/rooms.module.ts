import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [ChatModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}

