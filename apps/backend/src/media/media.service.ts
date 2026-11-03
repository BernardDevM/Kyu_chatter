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
import { toMediaResponse } from './media.mapper.js';

/** Lifetime of a presigned upload signature. */
const SIGNATURE_TTL_SECONDS = 3600;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Generates signed upload credentials for uploading directly to Cloudinary.
   * The Cloudinary public ID doubles as the storage key
   * (`chat-uploads/{userId}/{mediaId}`) and is the only signed parameter besides
   * the timestamp, so `params` can be posted verbatim by the client.
   */
  async requestSignature(
    userId: string,
    dto: RequestUploadSignatureDto,
  ): Promise<UploadSignatureResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const tempStorageKey = `temp_${userId}_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

    const media = await this.prisma.media.create({
      data: {
        uploadedById: userId,
        storageKey: tempStorageKey,
        storageProvider: 'cloudinary',
        originalName: dto.filename,
        mimeType: dto.mimeType,
        bytes: dto.bytes,
        kind: dto.kind,
        status: MediaStatus.UPLOADING,
      },
    });

    const storageKey = `chat-uploads/${userId}/${media.id}`;
    await this.prisma.media.update({
      where: { id: media.id },
      data: { storageKey },
    });

    const signature = this.cloudinaryService.signUploadParameters({
      public_id: storageKey,
      timestamp,
    });

    const cloudName = this.cloudinaryService.getCloudName();

    return {
      mediaId: media.id,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      storageKey,
      params: {
        timestamp,
        signature,
        api_key: this.cloudinaryService.getApiKey(),
        public_id: storageKey,
      },
      expiresAt: new Date((timestamp + SIGNATURE_TTL_SECONDS) * 1000).toISOString(),
    };
  }

  /**
   * Confirms a completed client-side upload and marks the asset READY.
   * The byte size is the one declared when the signature was requested.
   */
  async confirmUpload(
    userId: string,
    dto: ConfirmUploadDto,
  ): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${dto.mediaId} not found`);
    }
    if (media.uploadedById !== userId) {
      throw new ForbiddenException('You do not own this media asset');
    }
    if (media.storageKey !== dto.storageKey) {
      throw new BadRequestException(
        'storageKey does not match the one issued for this media asset',
      );
    }

    const updated = await this.prisma.media.update({
      where: { id: dto.mediaId },
      data: {
        url: dto.url,
        width: dto.width ?? null,
        height: dto.height ?? null,
        duration: dto.duration ?? null,
        status: MediaStatus.READY,
      },
    });

    return toMediaResponse(updated);
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

    return toMediaResponse(media);
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
