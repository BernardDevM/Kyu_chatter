import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RoomAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: { id?: string };
        roomMember?: { roomId: string; userId: string; role: string };
      }
    >();

    const rawRoomId = request.params?.roomId ?? request.body?.roomId;
    const roomId = Array.isArray(rawRoomId)
      ? rawRoomId[0]
      : typeof rawRoomId === 'string'
        ? rawRoomId
        : undefined;

    const userId = request.user?.id;

    if (!roomId) {
      return true;
    }

    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    let member = request.roomMember;
    if (!member) {
      const dbMember = await this.prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });

      if (!dbMember) {
        if (
          process.env.NODE_ENV !== 'production' &&
          process.env.ALLOW_DEV_USER_HEADER === 'true'
        ) {
          const room = await this.prisma.room.findUnique({ where: { id: roomId } });
          if (!room) {
            request.roomMember = { roomId, userId, role: 'OWNER' };
            return true;
          }
        }
        throw new ForbiddenException('You are not a member of this room');
      }

      member = dbMember;
      request.roomMember = member;
    }

    if (member.role !== 'ADMIN' && member.role !== 'OWNER') {
      throw new ForbiddenException('Admin or owner role required for this action');
    }

    return true;
  }
}
