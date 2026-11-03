import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { MessageIdParamDto } from '../common/dto/message-id-param.dto.js';
import { MessagesService } from './messages.service.js';
import { EditMessageDto } from './dto/edit-message.dto.js';
import { AddReactionDto } from './dto/add-reaction.dto.js';
import { RemoveReactionQueryDto } from './dto/remove-reaction-query.dto.js';
import type {
  MessageResponse,
  ReactionSummaryResponse,
  ReceiptResponse,
} from './dto/message.response.js';

@ApiTags('Messages')
@ApiBearerAuth('session-auth')
@ApiSecurity('dev-user-id')
@Controller('api/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Edits the body text of a message previously sent by the caller.
   */
  @ApiOperation({ summary: 'Edit message body' })
  @Patch(':messageId')
  async editMessage(
    @CurrentUser('id') userId: string,
    @Param() params: MessageIdParamDto,
    @Body() dto: EditMessageDto,
  ): Promise<MessageResponse> {
    return this.messagesService.editMessage(userId, params.messageId, dto);
  }

  /**
   * Soft-deletes a message previously sent by the caller.
   */
  @ApiOperation({ summary: 'Soft-delete message' })
  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @CurrentUser('id') userId: string,
    @Param() params: MessageIdParamDto,
  ): Promise<void> {
    return this.messagesService.deleteMessage(userId, params.messageId);
  }

  /**
   * Adds an emoji reaction to a message.
   */
  @ApiOperation({ summary: 'Add emoji reaction to message' })
  @Post(':messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async addReaction(
    @CurrentUser('id') userId: string,
    @Param() params: MessageIdParamDto,
    @Body() dto: AddReactionDto,
  ): Promise<ReactionSummaryResponse[]> {
    return this.messagesService.addReaction(userId, params.messageId, dto);
  }

  /**
   * Removes an emoji reaction from a message.
   */
  @ApiOperation({ summary: 'Remove emoji reaction from message' })
  @Delete(':messageId/reactions')
  async removeReaction(
    @CurrentUser('id') userId: string,
    @Param() params: MessageIdParamDto,
    @Query() query: RemoveReactionQueryDto,
  ): Promise<ReactionSummaryResponse[]> {
    return this.messagesService.removeReaction(userId, params.messageId, query);
  }

  /**
   * Retrieves read and delivery receipts for a message.
   */
  @ApiOperation({ summary: 'Get message delivery and read receipts' })
  @Get(':messageId/receipts')
  async getReceipts(
    @CurrentUser('id') userId: string,
    @Param() params: MessageIdParamDto,
  ): Promise<ReceiptResponse[]> {
    return this.messagesService.getReceipts(userId, params.messageId);
  }
}
