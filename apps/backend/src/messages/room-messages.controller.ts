import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RoomIdParamDto } from '../common/dto/room-id-param.dto.js';
import { MessagesService } from './messages.service.js';
import { SyncMessagesQueryDto } from './dto/sync-messages-query.dto.js';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import type {
  MessagePageResponse,
  MessageResponse,
} from './dto/message.response.js';

@ApiTags('Messages')
@ApiBearerAuth('session-auth')
@ApiSecurity('dev-user-id')
@Controller('api/rooms/:roomId/messages')
export class RoomMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Resynchronizes messages created after a given message ID (oldest first).
   * Declared before root and parameterized routes to prevent route collisions.
   */
  @ApiOperation({ summary: 'Resync missed messages after disconnect' })
  @Get('sync')
  async syncMessages(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Query() query: SyncMessagesQueryDto,
  ): Promise<MessageResponse[]> {
    return this.messagesService.syncMessages(userId, params.roomId, query);
  }

  /**
   * Retrieves paginated chronological message history for a room (newest first).
   */
  @ApiOperation({ summary: 'Paginate message history in a room' })
  @Get()
  async listMessages(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Query() query: ListMessagesQueryDto,
  ): Promise<MessagePageResponse> {
    return this.messagesService.listMessages(userId, params.roomId, query);
  }

  /**
   * Sends a message into the room (REST fallback to WebSocket delivery).
   */
  @ApiOperation({ summary: 'Send message to a room via REST' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponse> {
    return this.messagesService.sendMessage(userId, params.roomId, dto);
  }
}
