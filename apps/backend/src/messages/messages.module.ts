import { Module } from '@nestjs/common';
import { RoomMessagesController } from './room-messages.controller.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  controllers: [RoomMessagesController, MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
