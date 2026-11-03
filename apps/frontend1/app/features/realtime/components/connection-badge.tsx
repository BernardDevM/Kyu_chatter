import { cn } from "@/lib/utils";

import { useConnectionStore } from "../stores/connection-store";

const LABEL = {
  connected: "live",
  connecting: "connecting",
  disconnected: "offline",
} as const;

/** `compact` renders just the status dot (used in the narrow rail). */
export function ConnectionBadge({ compact = false }: { compact?: boolean }) {
  const status = useConnectionStore((s) => s.status);
  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[11px]"
      title={`Realtime: ${LABEL[status]}`}
    >
      <span
        className={cn(
          "size-2.5 rounded-full",
          status === "connected" && "bg-online",
          status === "connecting" && "animate-pulse bg-amber-400",
          status === "disconnected" && "bg-destructive",
        )}
      />
      {!compact && LABEL[status]}
    </span>
  );
}
