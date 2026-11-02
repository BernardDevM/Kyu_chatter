import { Injectable } from '@nestjs/common';
import type {
  MeResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from './dto/user.response.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SearchUsersQueryDto } from './dto/search-users-query.dto.js';

@Injectable()
export class UsersService {
  /**
   * Retrieves the authenticated user's private profile.
   */
  async getMe(userId: string): Promise<MeResponse> {
    // TODO(impl): Query prisma.user.findUniqueOrThrow({ where: { id: userId } })
    // Retrieve email, emailVerified, image, createdAt, lastSeenAt, and calculate isOnline from Redis.
    return {
      id: userId,
      name: 'Sample User',
      email: 'user@example.com',
      emailVerified: true,
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      lastSeenAt: new Date().toISOString(),
      isOnline: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  /**
   * Updates display name and/or avatar image for the authenticated user.
   */
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<MeResponse> {
    // TODO(impl): Update prisma.user.update({ where: { id: userId }, data: { name: dto.name, image: dto.image } })
    // Emit user:updated event over Redis pub/sub to notify active socket sessions.
    return {
      id: userId,
      name: dto.name ?? 'Sample User',
      email: 'user@example.com',
      emailVerified: true,
      image: dto.image ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      lastSeenAt: new Date().toISOString(),
      isOnline: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  /**
   * Searches users by name prefix or substring, omitting sensitive emails.
   */
  async searchUsers(userId: string, query: SearchUsersQueryDto): Promise<UserSummaryResponse[]> {
    // TODO(impl): prisma.user.findMany({ where: { name: { contains: query.q, mode: 'insensitive' }, id: { not: userId } }, take: query.limit, select: { id: true, name: true, image: true } })
    const limit = query.limit ?? 10;
    return [
      {
        id: 'usr_sample_1',
        name: `${query.q} Smith`,
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      },
      {
        id: 'usr_sample_2',
        name: `Jane ${query.q}`,
        image: null,
      },
    ].slice(0, limit);
  }

  /**
   * Retrieves public profile and activity status for a specific user ID.
   */
  async getUserProfile(userId: string, targetUserId: string): Promise<UserProfileResponse> {
    // TODO(impl): prisma.user.findUniqueOrThrow({ where: { id: targetUserId }, select: { id: true, name: true, image: true, lastSeenAt: true } })
    // Check Redis presence cache for isOnline status.
    return {
      id: targetUserId,
      name: 'Jane Doe',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      lastSeenAt: new Date().toISOString(),
      isOnline: true,
    };
  }
}
