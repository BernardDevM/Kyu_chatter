import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/features/presence/components/presence-dot";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  image,
  userId,
  className,
}: {
  name: string;
  image?: string | null;
  /** when set, shows a presence dot */
  userId?: string;
  className?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn("size-9", className)}>
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
          {initials(name) || "?"}
        </AvatarFallback>
      </Avatar>
      {userId && <PresenceDot userId={userId} />}
    </span>
  );
}
