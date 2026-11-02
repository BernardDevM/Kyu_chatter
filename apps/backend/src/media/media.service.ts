import { Injectable } from '@nestjs/common';
import { AttachmentKind, MediaStatus } from '../generated/prisma/enums.js';
import type {
  MediaResponse,
  UploadSignatureResponse,
} from './dto/media.response.js';
import type { RequestUploadSignatureDto } from './dto/request-upload-signature.dto.js';
import type { ConfirmUploadDto } from './dto/confirm-upload.dto.js';

@Injectable()
export class MediaService {
  /**
   * Generates signed upload credentials for uploading directly to Cloudinary.
   */
  async requestSignature(
    userId: string,
    _dto: RequestUploadSignatureDto,
  ): Promise<UploadSignatureResponse> {
    // TODO(impl):
    // 1. Create pending record: prisma.media.create({ data: {
    //      uploadedById: userId, storageKey: `kyu/${userId}/${Date.now()}`, storageProvider: 'cloudinary',
    //      originalName: _dto.originalName, mimeType: _dto.mimeType, bytes: BigInt(_dto.bytes),
    //      kind: _dto.kind, status: MediaStatus.UPLOADING
    //    } })
    // 2. Generate Cloudinary HMAC-SHA256 signature with process.env.CLOUDINARY_API_SECRET.
    const timestamp = Math.floor(Date.now() / 1000);
    const mediaId = '018f3a5a-8b9a-7c2d-9e1f-777777777777';
    return {
      mediaId,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? 'kyu-chat',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '123456789012345',
      timestamp,
      signature: 'mock_cloudinary_signature_placeholder',
      folder: `kyu-chatter/${userId}`,
      publicId: `upload_${mediaId}`,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME ?? 'kyu-chat'}/auto/upload`,
      expiresAt: timestamp + 3600,
    };
  }

  /**
   * Confirms a completed client-side upload and marks the asset READY.
   */
  async confirmUpload(
    _userId: string,
    mediaId: string,
    dto: ConfirmUploadDto,
  ): Promise<MediaResponse> {
    // TODO(impl): Verify media.uploadedById === _userId.
    // Update prisma.media.update({
    //   where: { id: mediaId },
    //   data: {
    //     storageKey: dto.publicId,
    //     url: dto.url,
    //     bytes: BigInt(dto.bytes),
    //     width: dto.width,
    //     height: dto.height,
    //     duration: dto.duration,
    //     status: MediaStatus.READY,
    //   }
    // })
    return {
      id: mediaId,
      kind: AttachmentKind.IMAGE,
      status: MediaStatus.READY,
      url: dto.url,
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: dto.bytes,
      width: dto.width ?? 1200,
      height: dto.height ?? 800,
      duration: dto.duration ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves metadata for an uploaded media asset.
   */
  async getMedia(_userId: string, mediaId: string): Promise<MediaResponse> {
    // TODO(impl): Verify caller access to the media or associated room attachments.
    // Fetch via prisma.media.findUniqueOrThrow({ where: { id: mediaId } })
    // Convert BigInt bytes to number.
    return {
      id: mediaId,
      kind: AttachmentKind.IMAGE,
      status: MediaStatus.READY,
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 204800,
      width: 1200,
      height: 800,
      duration: null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Deletes an unattached media asset owned by the caller.
   */
  async deleteMedia(_userId: string, _mediaId: string): Promise<void> {
    // TODO(impl): Ensure media.uploadedById === _userId.
    // Verify media has no references in prisma.attachment.findFirst({ where: { mediaId: _mediaId } })
    // Call Cloudinary destroy API for media.storageKey.
    // prisma.media.delete({ where: { id: _mediaId } })
  }
}
