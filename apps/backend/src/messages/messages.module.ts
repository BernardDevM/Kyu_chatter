import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessagesController } from './messages.controller.js';

@Module({
  providers: [MessagesService],
  controllers: [MessagesController]
})
export class MessagesModule {}
