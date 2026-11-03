import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  MeResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from './dto/user.response.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SearchUsersQueryDto } from './dto/search-users-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.toMeResponse(user);
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

    return this.toMeResponse(updatedUser);
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
   * Retrieves the public profile for a specific user ID.
   */
  async getUserProfile(targetUserId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    return {
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private toMeResponse(user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    createdAt: Date;
  }): MeResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
