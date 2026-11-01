import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';
import { TypingService } from './typing.service.js';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, PresenceService, TypingService]
})
export class ChatModule {}
