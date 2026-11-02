import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import type {
  MediaResponse,
  UploadSignatureResponse,
} from './dto/media.response.js';
import type { RequestUploadSignatureDto } from './dto/request-upload-signature.dto.js';
import type { ConfirmUploadDto } from './dto/confirm-upload.dto.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Generates signed upload credentials for uploading directly to Cloudinary.
   */
  async requestSignature(
    userId: string,
    dto: RequestUploadSignatureDto,
  ): Promise<UploadSignatureResponse> {
    if (dto.roomId) {
      const membership = await this.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: dto.roomId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of the designated upload room',
        );
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kyu-chatter/${userId}`;
    const tempStorageKey = `temp_${userId}_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

    const media = await this.prisma.media.create({
      data: {
        uploadedById: userId,
        storageKey: tempStorageKey,
        storageProvider: 'cloudinary',
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        bytes: dto.bytes,
        kind: dto.kind,
        status: MediaStatus.UPLOADING,
      },
    });

    const publicId = `${folder}/media_${media.id}`;
    await this.prisma.media.update({
      where: { id: media.id },
      data: { storageKey: publicId },
    });

    const signature = this.cloudinaryService.signUploadParameters({
      folder,
      public_id: publicId,
      timestamp,
    });

    const cloudName = this.cloudinaryService.getCloudName();
    const apiKey = this.cloudinaryService.getApiKey();

    return {
      mediaId: media.id,
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      expiresAt: timestamp + 3600,
    };
  }

  /**
   * Confirms a completed client-side upload and marks the asset READY.
   */
  async confirmUpload(
    userId: string,
    mediaId: string,
    dto: ConfirmUploadDto,
  ): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }
    if (media.uploadedById !== userId) {
      throw new ForbiddenException('You do not own this media asset');
    }

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        storageKey: dto.publicId,
        url: dto.url,
        bytes: dto.bytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        duration: dto.duration ?? null,
        status: MediaStatus.READY,
      },
    });

    return {
      id: updated.id,
      kind: updated.kind,
      status: updated.status,
      url: updated.url,
      originalName: updated.originalName,
      mimeType: updated.mimeType,
      bytes: Number(updated.bytes),
      width: updated.width,
      height: updated.height,
      duration: updated.duration,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves metadata for an uploaded media asset.
   */
  async getMedia(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        attachments: {
          include: {
            message: {
              include: {
                room: {
                  include: {
                    members: {
                      where: { userId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    const isUploader = media.uploadedById === userId;
    const isRoomMember = media.attachments.some(
      (att) => (att.message?.room?.members?.length ?? 0) > 0,
    );

    if (!isUploader && !isRoomMember) {
      throw new ForbiddenException('You do not have access to this media asset');
    }

    return {
      id: media.id,
      kind: media.kind,
      status: media.status,
      url: media.url,
      originalName: media.originalName,
      mimeType: media.mimeType,
      bytes: Number(media.bytes),
      width: media.width,
      height: media.height,
      duration: media.duration,
      createdAt: media.createdAt.toISOString(),
    };
  }

  /**
   * Deletes an unattached media asset owned by the caller.
   */
  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        attachments: true,
      },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }
    if (media.uploadedById !== userId) {
      throw new ForbiddenException('You do not own this media asset');
    }
    if (media.attachments.length > 0) {
      throw new BadRequestException(
        'Cannot delete media that is already attached to messages',
      );
    }

    await this.cloudinaryService.deleteResource(media.storageKey);

    await this.prisma.media.delete({
      where: { id: mediaId },
    });
  }
}
