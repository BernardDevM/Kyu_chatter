import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PresenceQueryDto } from './dto/presence-query.dto.js';
import { PresenceService } from './presence.service.js';
import {
  toPresenceResponse,
  type PresenceResponse,
} from './dto/presence.response.js';

@ApiTags('Presence')
@ApiBearerAuth('session-auth')
@ApiSecurity('dev-user-id')
@Controller('api/presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Retrieves online presence and last active timestamp for multiple users.
   */
  @ApiOperation({ summary: 'Batch query online presence for multiple users' })
  @Get()
  async getPresence(
    @CurrentUser('id') userId: string,
    @Query() query: PresenceQueryDto,
  ): Promise<PresenceResponse> {
    const snapshot = await this.presenceService.getPresence(
      userId,
      query.userIds,
    );
    return toPresenceResponse(snapshot);
  }
}
