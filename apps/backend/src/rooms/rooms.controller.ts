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
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RoomIdParamDto } from '../common/dto/room-id-param.dto.js';
import { RoomMemberParamDto } from '../common/dto/room-member-param.dto.js';
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

@Controller('api/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Creates a new group conversation room.
   */
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
  @Post(':roomId/read')
  async markRead(
    @CurrentUser('id') userId: string,
    @Param() params: RoomIdParamDto,
    @Body() dto: MarkReadDto,
  ): Promise<MarkReadResponse> {
    return this.roomsService.markRead(userId, params.roomId, dto);
  }
}
