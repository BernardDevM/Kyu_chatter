import type { MediaResponse } from './dto/media.response.js';

interface MediaRecord {
  id: string;
  storageKey: string;
  url: string | null;
  kind: MediaResponse['kind'];
  status: MediaResponse['status'];
  bytes: number | bigint;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: Date;
}

/**
 * Maps a Prisma Media row to the public `MediaResponse` contract.
 */
export function toMediaResponse(media: MediaRecord): MediaResponse {
  return {
    id: media.id,
    storageKey: media.storageKey,
    url: media.url,
    kind: media.kind,
    status: media.status,
    bytes: Number(media.bytes),
    width: media.width,
    height: media.height,
    duration: media.duration,
    createdAt: media.createdAt.toISOString(),
  };
}
