import { cn } from "@/lib/utils";

import { useConnectionStore } from "../stores/connection-store";

const LABEL = {
  connected: "Live",
  connecting: "Connecting…",
  disconnected: "Offline",
} as const;

export function ConnectionBadge() {
  const status = useConnectionStore((s) => s.status);
  return (
    <span
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
      title="Realtime connection"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status === "connected" && "bg-online",
          status === "connecting" && "animate-pulse bg-amber-400",
          status === "disconnected" && "bg-destructive",
        )}
      />
      {LABEL[status]}
    </span>
  );
}
