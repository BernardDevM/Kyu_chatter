import { cn } from "@/lib/utils";

import { useConnectionStore } from "../stores/connection-store";

const LABEL = {
  connected: "live",
  connecting: "connecting",
  disconnected: "offline",
} as const;

export function ConnectionBadge() {
  const status = useConnectionStore((s) => s.status);
  return (
    <span
      className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]"
      title="Realtime connection"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "connected" && "bg-online",
          status === "connecting" && "animate-pulse bg-amber-400",
          status === "disconnected" && "bg-destructive",
        )}
      />
      {LABEL[status]}
    </span>
  );
}
