import { FileText } from "lucide-react";

import type { MediaItem } from "@/features/media/types/media";

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MessageAttachments({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((m) => {
        if (m.kind === "IMAGE")
          return (
            <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
              <img
                src={m.url}
                alt=""
                loading="lazy"
                className="max-h-64 max-w-full rounded-lg border object-cover"
              />
            </a>
          );
        if (m.kind === "VIDEO")
          return (
            <video
              key={m.id}
              src={m.url}
              controls
              className="max-h-64 max-w-full rounded-lg border"
            />
          );
        if (m.kind === "AUDIO")
          return <audio key={m.id} src={m.url} controls className="max-w-full" />;
        return (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="bg-secondary hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <FileText className="size-4" />
            <span>
              {m.storageKey?.split("/").at(-1) ?? "Download file"}
              {m.bytes ? ` · ${formatBytes(m.bytes)}` : ""}
            </span>
          </a>
        );
      })}
    </div>
  );
}
