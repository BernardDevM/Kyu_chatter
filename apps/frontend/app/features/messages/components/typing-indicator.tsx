import { useTypingStore } from "@/features/realtime/stores/typing-store";
import type { RoomMember } from "@/features/rooms/types/room";

export function TypingIndicator({
  roomId,
  members,
}: {
  roomId: string;
  members: RoomMember[];
}) {
  const ids = useTypingStore((s) => s.typing[roomId]);
  if (!ids || ids.length === 0) return <div className="h-5" />;

  const names = ids.map(
    (id) => members.find((m) => m.userId === id)?.user.name.split(" ")[0] ?? "Someone",
  );
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : "Several people are typing";

  return (
    <div className="text-muted-foreground flex h-5 items-center gap-1.5 px-4 text-xs">
      <span className="flex gap-0.5">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="bg-muted-foreground size-1 animate-bounce rounded-full"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
