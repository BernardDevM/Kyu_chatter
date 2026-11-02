import { cn } from "@/lib/utils";

import { useConnectionStore } from "../stores/connection-store";

const LABEL = {
  connected: "Live",
  connecting: "Connecting…",
  disconnected: "Offline",
} as const;

/** `compact` renders just the status dot (used in the narrow rail). */
export function ConnectionBadge({ compact = false }: { compact?: boolean }) {
  const status = useConnectionStore((s) => s.status);
  return (
    <span
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
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
