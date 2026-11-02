import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { RoomMemberGuard } from '../../src/common/guards/room-member.guard.js';
import { RoomAdminGuard } from '../../src/common/guards/room-admin.guard.js';
import { RoomOwnerGuard } from '../../src/common/guards/room-owner.guard.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

describe('Room Permission Guards', () => {
  const mockPrisma = {
    roomMember: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;

  function createMockContext(
    roomId: string,
    userId: string,
    roomMember?: { roomId: string; userId: string; role: string },
  ): ExecutionContext {
    const request = {
      params: { roomId },
      user: { id: userId },
      roomMember,
    } as unknown as Request;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  describe('RoomMemberGuard', () => {
    const guard = new RoomMemberGuard(mockPrisma);

    it('allows access if user is a room member', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'MEMBER',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('throws ForbiddenException if user is not a member of existing room', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce(null as never);
      vi.spyOn(mockPrisma.room, 'findUnique').mockResolvedValueOnce({ id: 'room-1' } as never);

      const ctx = createMockContext('room-1', 'user-1');
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('RoomAdminGuard', () => {
    const guard = new RoomAdminGuard(mockPrisma);

    it('allows access if user is ADMIN', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'ADMIN',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('allows access if user is OWNER', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'OWNER',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('throws ForbiddenException if user is only MEMBER', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'MEMBER',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('RoomOwnerGuard', () => {
    const guard = new RoomOwnerGuard(mockPrisma);

    it('allows access if user is OWNER', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'OWNER',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('throws ForbiddenException if user is ADMIN but not OWNER', async () => {
      vi.spyOn(mockPrisma.roomMember, 'findUnique').mockResolvedValueOnce({
        roomId: 'room-1',
        userId: 'user-1',
        role: 'ADMIN',
      } as never);

      const ctx = createMockContext('room-1', 'user-1');
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
