import { MessageSquarePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useRoomsQuery } from "../api/use-room-service";
import { useNewChatStore } from "../stores/new-chat-store";
import { sortRooms } from "../utils/room-title";
import { RoomListItem } from "./room-list-item";

type Filter = "all" | "DIRECT" | "GROUP" | "archived";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "DIRECT", label: "People" },
  { value: "GROUP", label: "Groups" },
  { value: "archived", label: "Archived" },
];

export function RoomList() {
  const { data, isPending } = useRoomsQuery();
  const onOpen = useNewChatStore((s) => s.onOpen);
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");

  const rooms = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return sortRooms(data ?? []).filter((r) => {
      const isArchived = r.preference?.isArchived ?? (r as unknown as { preferences?: { isArchived?: boolean } }).preferences?.isArchived ?? false;
      if (filter === "archived") return isArchived;
      if (isArchived) return false;
      if (filter !== "all" && r.type !== filter) return false;
      // Direct rooms are titled from member data, so name search covers groups.
      return !needle || (r.name ?? "").toLowerCase().includes(needle);
    });
  }, [data, filter, text]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-5 pb-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search chats"
            className="bg-muted h-11 rounded-full border-0 pl-10 shadow-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-3 pb-4">
          {isPending ? (
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
            ))
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title={filter === "archived" ? "Nothing archived" : "No chats yet"}
              description="Start a conversation with someone."
              action={
                filter !== "archived" && (
                  <Button className="rounded-full" onClick={() => onOpen()}>
                    New chat
                  </Button>
                )
              }
            />
          ) : (
            rooms.map((room) => <RoomListItem key={room.id} room={room} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
