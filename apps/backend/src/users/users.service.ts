import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresenceService } from '../chat/presence.service.js';
import type {
  MeResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from './dto/user.response.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SearchUsersQueryDto } from './dto/search-users-query.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  /**
   * Retrieves the authenticated user's private profile.
   */
  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const presenceRes = await this.presenceService.getPresence(userId, [userId]);
    const isOnline = presenceRes.presence[userId]?.online ?? true;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
      isOnline,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Updates display name and/or avatar image for the authenticated user.
   */
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      image: updatedUser.image,
      lastSeenAt: updatedUser.lastSeenAt ? updatedUser.lastSeenAt.toISOString() : null,
      isOnline: true,
      createdAt: updatedUser.createdAt.toISOString(),
    };
  }

  /**
   * Searches users by name prefix or substring, omitting sensitive emails.
   */
  async searchUsers(
    userId: string,
    query: SearchUsersQueryDto,
  ): Promise<UserSummaryResponse[]> {
    const limit = query.limit ?? 10;
    const q = query.q?.trim();

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit,
      select: {
        id: true,
        name: true,
        image: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      image: u.image,
    }));
  }

  /**
   * Retrieves public profile and activity status for a specific user ID.
   */
  async getUserProfile(
    userId: string,
    targetUserId: string,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        image: true,
        lastSeenAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const presenceRes = await this.presenceService.getPresence(userId, [targetUserId]);
    const targetPresence = presenceRes.presence[targetUserId];
    const isOnline = targetPresence?.online ?? false;
    const lastSeenAt =
      targetPresence?.lastSeenAt ??
      (user.lastSeenAt ? user.lastSeenAt.toISOString() : null);

    return {
      id: user.id,
      name: user.name,
      image: user.image,
      lastSeenAt,
      isOnline,
    };
  }
}
