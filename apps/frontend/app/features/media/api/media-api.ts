import { apiClient } from "@/lib/api/client";

import type { MediaItem, MediaKind, UploadSignature } from "../types/media";

export function kindOf(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

export const mediaApi = {
  signature: {
    call: async (file: File) =>
      (
        await apiClient.post<UploadSignature>("/api/media/signature", {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          bytes: file.size,
          kind: kindOf(file.type),
        })
      ).data,
  },
  confirm: {
    call: async (body: {
      mediaId: string;
      storageKey: string;
      url: string;
      width?: number;
      height?: number;
      duration?: number;
    }) => (await apiClient.post<MediaItem>("/api/media/confirm", body)).data,
  },
  remove: { call: (id: string) => apiClient.delete(`/api/media/${id}`) },
};
