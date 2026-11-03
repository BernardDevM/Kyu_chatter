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
  if (!ids || ids.length === 0) return <div className="h-9" />;

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
    <div className="flex h-9 items-center gap-2 px-4 md:px-8">
      <span className="bg-muted flex items-center gap-1 rounded-full px-3 py-2">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="bg-primary size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
