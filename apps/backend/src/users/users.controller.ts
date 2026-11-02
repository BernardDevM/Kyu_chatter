import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Users')
@ApiBearerAuth('session-auth')
@ApiSecurity('dev-user-id')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retrieves the current authenticated user's profile.
   */
  @ApiOperation({ summary: "Get current authenticated user's profile" })
  @Get('me')
  async getMe(@CurrentUser('id') userId: string): Promise<MeResponse> {
    return this.usersService.getMe(userId);
  }

  /**
   * Updates profile attributes for the authenticated user.
   */
  @ApiOperation({ summary: 'Update current user profile' })
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
  @ApiOperation({ summary: 'Search users by keyword' })
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
  @ApiOperation({ summary: 'Get public user profile by ID' })
  @Get(':id')
  async getUserProfile(
    @CurrentUser('id') userId: string,
    @Param() params: UserIdParamDto,
  ): Promise<UserProfileResponse> {
    return this.usersService.getUserProfile(userId, params.id);
  }
}
