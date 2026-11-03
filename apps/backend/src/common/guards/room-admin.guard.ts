
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { MemberRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

interface RoomGuardRequest extends Request {
  user?: {
    id?: string;
  };
  roomMember?: {
    roomId: string;
    userId: string;
    role: MemberRole;
  };
}

@Injectable()
export class RoomAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
 const request =
  context.switchToHttp().getRequest<RoomGuardRequest>();

// Extract and normalize room ID
const rawRoomId = request.params?.roomId;

const roomId = Array.isArray(rawRoomId)
  ? rawRoomId[0]
  : typeof rawRoomId === 'string'
    ? rawRoomId
    : undefined;

// Extract authenticated user ID
const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (!roomId) {
      throw new ForbiddenException('Room ID is required.');
    }

    let member = request.roomMember;

    if (!member) {
      member = await this.prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
        select: {
          roomId: true,
          userId: true,
          role: true,
        },
      }) ?? undefined;

      if (!member) {
        throw new ForbiddenException(
          'You are not a member of this room.',
        );
      }

      request.roomMember = member;
    }

    if (
      member.role !== MemberRole.ADMIN &&
      member.role !== MemberRole.OWNER
    ) {
      throw new ForbiddenException(
        'Admin or owner role required for this action.',
      );
    }

    return true;
  }
}
