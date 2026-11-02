import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
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
    it('generates signed upload credentials and creates pending media record', async () => {
      prismaMock.media.create.mockResolvedValue({
        id: 'media_1',
        storageKey: 'temp_key',
      });
      prismaMock.media.update.mockResolvedValue({});

      const res = await service.requestSignature('user_1', {
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 10240,
        kind: AttachmentKind.IMAGE,
      });

      expect(prismaMock.media.create).toHaveBeenCalled();
      expect(prismaMock.media.update).toHaveBeenCalledWith({
        where: { id: 'media_1' },
        data: { storageKey: 'kyu-chatter/user_1/media_media_1' },
      });
      expect(cloudinaryMock.signUploadParameters).toHaveBeenCalled();
      expect(res.mediaId).toBe('media_1');
      expect(res.cloudName).toBe('kyu-cloud');
      expect(res.signature).toBe('mock_sha_signature');
      expect(res.publicId).toBe('kyu-chatter/user_1/media_media_1');
      expect(res.uploadUrl).toBe('https://api.cloudinary.com/v1_1/kyu-cloud/auto/upload');
    });

    it('throws ForbiddenException if user is not member of target roomId', async () => {
      prismaMock.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.requestSignature('user_1', {
          originalName: 'doc.pdf',
          mimeType: 'application/pdf',
          bytes: 1024,
          kind: AttachmentKind.FILE,
          roomId: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('confirmUpload', () => {
    it('marks media record READY and updates dimensions and URL', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'user_1',
        kind: AttachmentKind.IMAGE,
        status: MediaStatus.UPLOADING,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 10240,
        createdAt: now,
      });
      prismaMock.media.update.mockResolvedValue({
        id: 'media_1',
        kind: AttachmentKind.IMAGE,
        status: MediaStatus.READY,
        url: 'https://res.cloudinary.com/kyu/photo.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 10240,
        width: 1920,
        height: 1080,
        duration: null,
        createdAt: now,
      });

      const res = await service.confirmUpload('user_1', 'media_1', {
        publicId: 'kyu-chatter/user_1/media_media_1',
        url: 'https://res.cloudinary.com/kyu/photo.jpg',
        bytes: 10240,
        width: 1920,
        height: 1080,
      });

      expect(res.status).toBe(MediaStatus.READY);
      expect(res.width).toBe(1920);
      expect(res.url).toBe('https://res.cloudinary.com/kyu/photo.jpg');
    });

    it('throws ForbiddenException if non-owner confirms upload', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'other_user',
      });

      await expect(
        service.confirmUpload('user_1', 'media_1', {
          publicId: 'key',
          url: 'https://example.com/asset',
          bytes: 100,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMedia', () => {
    it('returns media when user is uploader', async () => {
      prismaMock.media.findUnique.mockResolvedValue({
        id: 'media_1',
        uploadedById: 'user_1',
        kind: AttachmentKind.IMAGE,
        status: MediaStatus.READY,
        url: 'https://example.com/photo.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
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
        storageKey: 'kyu-chatter/user_1/media_media_1',
        attachments: [],
      });
      prismaMock.media.delete.mockResolvedValue({});

      await service.deleteMedia('user_1', 'media_1');

      expect(cloudinaryMock.deleteResource).toHaveBeenCalledWith(
        'kyu-chatter/user_1/media_media_1',
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
