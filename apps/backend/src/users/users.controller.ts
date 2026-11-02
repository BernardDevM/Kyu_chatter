import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserIdParamDto } from '../common/dto/user-id-param.dto.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SearchUsersQueryDto } from './dto/search-users-query.dto.js';
import type {
  MeResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from './dto/user.response.js';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retrieves the current authenticated user's profile.
   */
  @Get('me')
  async getMe(@CurrentUser('id') userId: string): Promise<MeResponse> {
    return this.usersService.getMe(userId);
  }

  /**
   * Updates profile attributes for the authenticated user.
   */
  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    return this.usersService.updateMe(userId, dto);
  }

  /**
   * Searches users by keyword for starting new conversations.
   */
  @Get('search')
  async searchUsers(
    @CurrentUser('id') userId: string,
    @Query() query: SearchUsersQueryDto,
  ): Promise<UserSummaryResponse[]> {
    return this.usersService.searchUsers(userId, query);
  }

  /**
   * Retrieves a user's public profile.
   */
  @Get(':id')
  async getUserProfile(
    @CurrentUser('id') userId: string,
    @Param() params: UserIdParamDto,
  ): Promise<UserProfileResponse> {
    return this.usersService.getUserProfile(userId, params.id);
  }
}
