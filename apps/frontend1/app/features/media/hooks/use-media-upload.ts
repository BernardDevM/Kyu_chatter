import { useMutation } from "@tanstack/react-query";

import { handleError } from "@/lib/handle-error";

import { mediaApi } from "../api/media-api";
import type { MediaItem } from "../types/media";

interface StoredUpload {
  secure_url?: string;
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** signature -> direct upload to storage -> confirm. Resolves the confirmed media record. */
async function uploadFile(file: File): Promise<MediaItem> {
  const sig = await mediaApi.signature.call(file);
  const form = new FormData();
  for (const [key, value] of Object.entries(sig.params))
    form.append(key, String(value));
  form.append("file", file);

  const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const stored = (await res.json()) as StoredUpload;
  const url = stored.secure_url ?? stored.url;
  if (!url) throw new Error("Upload returned no URL");

  return mediaApi.confirm.call({
    mediaId: sig.mediaId,
    storageKey: sig.storageKey,
    url,
    width: stored.width,
    height: stored.height,
    duration: stored.duration
      ? Math.max(1, Math.round(stored.duration))
      : undefined,
  });
}

export function useMediaUpload() {
  return useMutation({
    mutationFn: uploadFile,
    onError: (e) => handleError(e, "upload the file"),
  });
}
