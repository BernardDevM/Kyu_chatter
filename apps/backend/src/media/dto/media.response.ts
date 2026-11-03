import type { AttachmentKind, MediaStatus } from '../../generated/prisma/enums.js';

/**
 * Public metadata for an uploaded media asset (docs/API.md §7.2).
 * `bytes` is serialized as a number. The same flat shape is embedded in
 * `MessageResponse.attachments`.
 */
export interface MediaResponse {
  id: string;
  storageKey: string;
  url: string | null;
  kind: AttachmentKind;
  status: MediaStatus;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
}

/**
 * Presigned direct-upload authorization (docs/API.md §7.1).
 * Every entry in `params` must be sent verbatim as a multipart form field
 * to `uploadUrl` together with the `file` field.
 */
export interface UploadSignatureResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  params: {
    timestamp: number;
    signature: string;
    api_key: string;
    public_id: string;
  };
  expiresAt: string;
}
