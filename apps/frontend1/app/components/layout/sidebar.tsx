import { SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoomList } from "@/features/rooms/components/room-list";
import { useNewChatStore } from "@/features/rooms/stores/new-chat-store";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  const onOpen = useNewChatStore((s) => s.onOpen);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-5 pt-5 pb-3">
        <h1 className="flex-1 text-2xl font-semibold">Chats</h1>
        {/* the rail carries these on larger screens */}
        <div className="flex items-center gap-1 md:hidden">
          <Button variant="secondary" size="icon" aria-label="New chat" onClick={() => onOpen()}>
            <SquarePen />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <RoomList />
    </div>
  );
}
