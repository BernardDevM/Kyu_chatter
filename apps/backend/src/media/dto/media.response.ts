import type { AttachmentKind, MediaStatus } from '../../generated/prisma/enums.js';

/**
 * Public metadata for an uploaded media asset.
 * Bytes is serialized as a number (converted from BigInt).
 */
export interface MediaResponse {
  id: string;
  kind: AttachmentKind;
  status: MediaStatus;
  url: string | null;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
}

/**
 * Association between a message and a media asset.
 */
export interface AttachmentResponse {
  id: string;
  media: MediaResponse;
}

/**
 * Signed upload authorization details for client-side direct upload to Cloudinary.
 */
export interface UploadSignatureResponse {
  mediaId: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  uploadUrl: string;
  expiresAt: number;
}
