import { MessagesSquare, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { ConnectionBadge } from "@/features/realtime/components/connection-badge";
import { RoomList } from "@/features/rooms/components/room-list";
import { useNewChatStore } from "@/features/rooms/stores/new-chat-store";

import { UserMenu } from "./user-menu";

export function Sidebar() {
  const onOpen = useNewChatStore((s) => s.onOpen);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 p-3">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
          <MessagesSquare className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{siteConfig.name}</p>
          <ConnectionBadge />
        </div>
        <Button
          variant="secondary"
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
