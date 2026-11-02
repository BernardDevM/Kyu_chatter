import { cn } from "@/lib/utils";

import { usePresence } from "../api/use-presence-service";

export function PresenceDot({
  userId,
  className,
}: {
  userId: string | undefined;
  className?: string;
}) {
  const presence = usePresence(userId);
  if (!presence?.online) return null;
  return (
    <span
      aria-label="Online"
      className={cn(
        "bg-online ring-card absolute right-0 bottom-0 size-3 rounded-full ring-2",
        className,
      )}
    />
  );
}
