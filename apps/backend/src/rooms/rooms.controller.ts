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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RoomIdParamDto } from '../common/dto/room-id-param.dto.js';
import { RoomMemberParamDto } from '../common/dto/room-member-param.dto.js';
import { RoomMemberGuard } from '../common/guards/room-member.guard.js';
import { RoomAdminGuard } from '../common/guards/room-admin.guard.js';
import { RoomOwnerGuard } from '../common/guards/room-owner.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateGroupRoomDto } from './dto/create-group-room.dto.js';
import { CreateDirectRoomDto } from './dto/create-direct-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { AddMembersDto } from './dto/add-members.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { UpdateRoomPreferenceDto } from './dto/update-room-preference.dto.js';
import { MarkReadDto } from './dto/mark-read.dto.js';
import type {
  MarkReadResponse,
  RoomDetailResponse,
  RoomMemberResponse,
  RoomPageResponse,
  RoomPreferenceResponse,
} from './dto/room.response.js';
import {
  AuthGuard,
} from '@thallesp/nestjs-better-auth';

@ApiTags('Rooms')
@ApiBearerAuth('session-auth')
@UseGuards(AuthGuard)
@Controller('api/rooms')



export class RoomsController {
  
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Creates a new group conversation room.
   */
  @ApiOperation({ summary: 'Create a new group room' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGroupRoom(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGroupRoomDto,
  ): Promise<RoomDetailResponse> {
    return this.roomsService.createGroupRoom(userId, dto);
  }

  /**
   * Gets or creates a direct 1-on-1 room with another user.
   */
  @ApiOperation({ summary: 'Create or get direct 1-on-1 chat room' })
  @Post('direct')
  async createDirectRoom(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDirectRoomDto,
  ): Promise<RoomDetailResponse> {
    return this.roomsService.createDirectRoom(userId, dto);
  }

  /**
   * Lists conversation rooms for the authenticated user with pagination and filters.
   */
  @ApiOperation({ summary: 'List joined rooms with pagination and filters' })
  @Get()
  async listRooms(
    @CurrentUser('id') userId: string,
    @Query() query: ListRoomsQueryDto,
  ): Promise<RoomPageResponse> {
    return this.roomsService.listRooms(userId, query);
  }

  /**
   * Retrieves room details by ID.
   */
  @ApiOperation({ summary: 'Get room details and member list' })
  @UseGuards(RoomMemberGuard)
  @Get(':roomId')
  async getRoom(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
  ): Promise<RoomDetailResponse> {
    return this.roomsService.getRoom(userId, params.roomId);
  }

  /**
   * Updates group room attributes (name, description, image).
   */
  @ApiOperation({ summary: 'Update group room details' })
  @UseGuards(RoomAdminGuard)
  @Patch(':roomId')
  async updateRoom(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomDetailResponse> {
    return this.roomsService.updateRoom(userId, params.roomId, dto);
  }

  /**
   * Deletes a group room (owner only).
   */
  @ApiOperation({ summary: 'Delete a group room (owner only)' })
  @UseGuards(RoomOwnerGuard)
  @Delete(':roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
  ): Promise<void> {
    return this.roomsService.deleteRoom(userId, params.roomId);
  }

  /**
   * Lists all members of a room.
   */
  @ApiOperation({ summary: 'List all members in a room' })
  @UseGuards(RoomMemberGuard)
  @Get(':roomId/members')
  async listMembers(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
  ): Promise<RoomMemberResponse[]> {
    return this.roomsService.listMembers(userId, params.roomId);
  }

  /**
   * Adds new members to a group room.
   */
  @ApiOperation({ summary: 'Add members to a group room' })
  @UseGuards(RoomAdminGuard)
  @Post(':roomId/members')
  async addMembers(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: AddMembersDto,
  ): Promise<RoomMemberResponse[]> {
    return this.roomsService.addMembers(userId, params.roomId, dto);
  }

  /**
   * Updates a member's role within a group room.
   */
  @ApiOperation({ summary: 'Update member role (ADMIN or MEMBER)' })
  @UseGuards(RoomOwnerGuard)
  @Patch(':roomId/members/:userId')
  async updateMemberRole(
    @CurrentUser('id') userId: string,
    @Param() params: RoomMemberParamDto,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<RoomMemberResponse> {
    return this.roomsService.updateMemberRole(
      userId,
      params.roomId,
      params.userId,
      dto,
    );
  }

  /**
   * Removes a member from a room.
   */
  @ApiOperation({ summary: 'Remove a member from a room' })
  @UseGuards(RoomAdminGuard)
  @Delete(':roomId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param() params: RoomMemberParamDto,
  ): Promise<void> {
    return this.roomsService.removeMember(
      userId,
      params.roomId,
      params.userId,
    );
  }

  /**
   * Leaves a room.
   */
  @ApiOperation({ summary: 'Leave a room' })
  @UseGuards(RoomMemberGuard)
  @Post(':roomId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveRoom(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
  ): Promise<void> {
    return this.roomsService.leaveRoom(userId, params.roomId);
  }

  /**
   * Updates user preferences (mute, archive, pin) for a room.
   */
  @ApiOperation({ summary: 'Update room preferences (mute/archive/pin)' })
  @UseGuards(RoomMemberGuard)
  @Patch(':roomId/preferences')
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: UpdateRoomPreferenceDto,
  ): Promise<RoomPreferenceResponse> {
    return this.roomsService.updatePreferences(
      userId,
      params.roomId,
      dto,
    );
  }

  /**
   * Marks a room read up to a specific message ID.
   */
  @ApiOperation({ summary: 'Mark room read up to a message' })
  @UseGuards(RoomMemberGuard)
  @Post(':roomId/read')
  async markRead(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: MarkReadDto,
  ): Promise<MarkReadResponse> {
    return this.roomsService.markRead(userId, params.roomId, dto);
  }
}
