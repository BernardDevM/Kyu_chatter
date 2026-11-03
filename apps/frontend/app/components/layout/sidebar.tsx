import { SquarePen } from "lucide-react";

import { KyuMark } from "@/components/brand/kyu-mark";
import { Button } from "@/components/ui/button";
import { ConnectionBadge } from "@/features/realtime/components/connection-badge";
import { RoomList } from "@/features/rooms/components/room-list";
import { useNewChatStore } from "@/features/rooms/stores/new-chat-store";

import { UserMenu } from "./user-menu";

export function Sidebar() {
  const onOpen = useNewChatStore((s) => s.onOpen);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <KyuMark className="text-primary size-7 shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display truncate text-xl font-bold tracking-tight">kyu</p>
          <ConnectionBadge />
        </div>
        <Button
          size="icon"
          aria-label="New chat"
          onClick={() => onOpen()}
        >
          <SquarePen />
        </Button>
      </div>
      <RoomList />
      <UserMenu />
    </div>
  );
}
