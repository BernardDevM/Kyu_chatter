import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MediaService } from './media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { AttachmentKind, MediaStatus } from '../generated/prisma/enums.js';

describe('MediaService', () => {
  let service: MediaService;
  let prismaMock: any;
  let cloudinaryMock: any;

  const now = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(async () => {
    prismaMock = {
      media: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      roomMember: {
        findUnique: vi.fn(),
      },
    };

    cloudinaryMock = {
      getCloudName: vi.fn().mockReturnValue('kyu-cloud'),
      getApiKey: vi.fn().mockReturnValue('123456789'),
      signUploadParameters: vi.fn().mockReturnValue('mock_sha_signature'),
      deleteResource: vi.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestSignature', () => {
    it('returns the API.md upload signature shape and creates a pending media record', async () => {
      prismaMock.media.create.mockResolvedValue({
        id: 'media_1',
        storageKey: 'temp_key',
      });
      prismaMock.media.update.mockResolvedValue({});

      const res = await service.requestSignature('user_1', {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 10240,
        kind: AttachmentKind.IMAGE,
      });

      expect(prismaMock.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uploadedById: 'user_1',
          originalName: 'photo.jpg',
          mimeType: 'image/jpeg',
          bytes: 10240,
          kind: AttachmentKind.IMAGE,
          status: MediaStatus.UPLOADING,
        }),
      });
      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: 'media_1' },
        data: { storageKey: 'chat-uploads/user_1/media_1' },
      });
      expect(cloudinaryMock.signUploadParameters).toHaveBeenCalledWith({
        public_id: 'chat-uploads/user_1/media_1',
        timestamp: expect.any(Number),
      });
      expect(res).toEqual({
        mediaId: 'media_1',
        uploadUrl: 'https://api.cloudinary.com/v1_1/kyu-cloud/auto/upload',
        storageKey: 'chat-uploads/user_1/media_1',
        params: {
          timestamp: expect.any(Number),
          signature: 'mock_sha_signature',
          api_key: '123456789',
          public_id: 'chat-uploads/user_1/media_1',
        },
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      });
      expect(res.params.timestamp).toBe(
        cloudinaryMock.signUploadParameters.mock.calls[0][0].timestamp,
      );
    });
  });

  describe('confirmUpload', () => {
    const storageKey = 'chat-uploads/user_1/media_1';
    const pending = {
      id: 'media_1',
      uploadedById: 'user_1',
      storageKey,
      kind: AttachmentKind.IMAGE,
      status: MediaStatus.UPLOADING,
      bytes: 10240,
      createdAt: now,
    };

    it('marks media READY and returns the MediaResponse shape', async () => {
      prismaMock.media.findUnique.mockResolvedValue(pending);
      prismaMock.media.update.mockResolvedValue({
        ...pending,
        status: MediaStatus.READY,
        url: 'https://res.cloudinary.com/kyu/photo.jpg',
        width: 1920,
        height: 1080,
        duration: null,
      });

      const res = await service.confirmUpload('user_1', {
        mediaId: 'media_1',
        storageKey,
        url: 'https://res.cloudinary.com/kyu/photo.jpg',
        width: 1920,
        height: 1080,
      });

      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: 'media_1' },
        data: {
          url: 'https://res.cloudinary.com/kyu/photo.jpg',
          width: 1920,
          height: 1080,
          duration: null,
          status: MediaStatus.READY,
        },
      });
      expect(res).toEqual({
        id: 'media_1',
        storageKey,
        url: 'https://res.cloudinary.com/kyu/photo.jpg',
        kind: AttachmentKind.IMAGE,
        status: MediaStatus.READY,
        bytes: 10240,
        width: 1920,
        height: 1080,
        duration: null,
        createdAt: now.toISOString(),
      });
    });

    it('throws NotFoundException when the media does not exist', async () => {
      prismaMock.media.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmUpload('user_1', {
          mediaId: 'missing',
          storageKey,
          url: 'https://example.com/asset',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if non-owner confirms upload', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'other_user',
        storageKey,
      });

      await expect(
        service.confirmUpload('user_1', {
          mediaId: 'media_1',
          storageKey,
          url: 'https://example.com/asset',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when storageKey does not match the issued one', async () => {
      prismaMock.media.findUnique.mockResolvedValue(pending);

      await expect(
        service.confirmUpload('user_1', {
          mediaId: 'media_1',
          storageKey: 'chat-uploads/user_1/other',
          url: 'https://example.com/asset',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.media.update).not.toHaveBeenCalled();
    });
  });

  describe('getMedia', () => {
    it('returns media when user is uploader', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'user_1',
        kind: AttachmentKind.IMAGE,
        status: MediaStatus.READY,
        storageKey: 'chat-uploads/user_1/media_1',
        url: 'https://example.com/photo.jpg',
        bytes: 5000,
        width: 800,
        height: 600,
        duration: null,
        createdAt: now,
        attachments: [],
      });

      const res = await service.getMedia('user_1', 'media_1');
      expect(res.id).toBe('media_1');
      expect(res.bytes).toBe(5000);
      expect(res.storageKey).toBe('chat-uploads/user_1/media_1');
      expect(res).not.toHaveProperty('originalName');
    });

    it('throws ForbiddenException when user has no access to media', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'other_user',
        attachments: [],
      });

      await expect(service.getMedia('user_1', 'media_1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteMedia', () => {
    it('deletes unattached media owned by caller', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'user_1',
        storageKey: 'chat-uploads/user_1/media_1',
        attachments: [],
      });
      prismaMock.media.delete.mockResolvedValue({});

      await service.deleteMedia('user_1', 'media_1');

      expect(cloudinaryMock.deleteResource).toHaveBeenCalledWith(
        'chat-uploads/user_1/media_1',
      );
      expect(prismaMock.media.delete).toHaveBeenCalledWith({
        where: { id: 'media_1' },
      });
    });

    it('throws BadRequestException if media is attached to messages', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'user_1',
        attachments: [{ id: 'att_1' }],
      });

      await expect(service.deleteMedia('user_1', 'media_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
