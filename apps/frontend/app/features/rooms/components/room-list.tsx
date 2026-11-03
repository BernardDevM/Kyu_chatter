import { Archive, MessageSquarePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useRoomsQuery } from "../api/use-room-service";
import { useNewChatStore } from "../stores/new-chat-store";
import { sortRooms } from "../utils/room-title";
import { RoomListItem } from "./room-list-item";

type Filter = "all" | "DIRECT" | "GROUP" | "archived";

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
      <div className="space-y-2.5 px-4 pb-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search chats"
            className="h-9 pl-8"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="grid h-9 w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="DIRECT" className="text-xs">DMs</TabsTrigger>
            <TabsTrigger value="GROUP" className="text-xs">Groups</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs" aria-label="Archived">
              <Archive className="size-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 px-2.5 pb-3">
          {isPending ? (
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[3.75rem] w-full rounded-lg" />
            ))
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title={filter === "archived" ? "Nothing archived" : "No chats yet"}
              description="Start a conversation with someone."
              action={
                filter !== "archived" && (
                  <Button size="sm" onClick={() => onOpen()}>
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
