import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { TypingService } from './typing.service.js';

@Module({
  controllers: [PresenceController],
  providers: [ChatGateway, PresenceService, ChatService, TypingService],
  exports: [ChatGateway, PresenceService, ChatService, TypingService],
})
export class ChatModule {}
