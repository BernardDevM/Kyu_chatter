import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleDate = new Date('2026-01-01T00:00:00.000Z');
  const sampleUser = {
    id: 'user_1',
    name: 'Alice Wonder',
    email: 'alice@example.com',
    emailVerified: true,
    image: 'https://example.com/alice.png',
    createdAt: sampleDate,
    updatedAt: sampleDate,
    lastSeenAt: sampleDate,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMe', () => {
    it('returns the private profile in API shape when user exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser);

      const result = await service.getMe('user_1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_1' },
      });
      expect(result).toEqual({
        id: 'user_1',
        email: 'alice@example.com',
        name: 'Alice Wonder',
        image: 'https://example.com/alice.png',
        createdAt: sampleDate.toISOString(),
      });
    });

    it('throws NotFoundException if user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('unknown_user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates user display name and image', async () => {
      prismaMock.user.findUnique.mockResolvedValue(sampleUser);
      prismaMock.user.update.mockResolvedValue({
        ...sampleUser,
        name: 'Alice In Wonderland',
        image: 'https://example.com/alice2.png',
      });

      const result = await service.updateMe('user_1', {
        name: 'Alice In Wonderland',
        image: 'https://example.com/alice2.png',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: {
          name: 'Alice In Wonderland',
          image: 'https://example.com/alice2.png',
        },
      });
      expect(result.name).toBe('Alice In Wonderland');
      expect(result.image).toBe('https://example.com/alice2.png');
    });

    it('throws NotFoundException if user to update does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMe('unknown_user', { name: 'Bob' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchUsers', () => {
    it('searches users omitting caller and returning summaries', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user_2', name: 'Bob Builder', image: null },
      ]);

      const result = await service.searchUsers('user_1', { q: 'Bob', limit: 10 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: 'user_1' },
          OR: [
            { name: { contains: 'Bob', mode: 'insensitive' } },
            { email: { contains: 'Bob', mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          name: true,
          image: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
      expect(result).toEqual([
        { id: 'user_2', name: 'Bob Builder', image: null },
      ]);
    });
  });

  describe('getUserProfile', () => {
    it('returns the target user public profile in API shape', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Bob',
        image: null,
        createdAt: sampleDate,
      });

      const result = await service.getUserProfile('user_2');

      expect(result).toEqual({
        id: 'user_2',
        name: 'Bob',
        image: null,
        createdAt: sampleDate.toISOString(),
      });
    });

    it('throws NotFoundException if target user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getUserProfile('unknown_user'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
