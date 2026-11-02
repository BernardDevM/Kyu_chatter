import { MessagesSquare, SquarePen } from "lucide-react";
import type { ReactNode } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { ConnectionBadge } from "@/features/realtime/components/connection-badge";
import { useNewChatStore } from "@/features/rooms/stores/new-chat-store";
import { cn } from "@/lib/utils";

import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Floating-card layout: a slim icon rail, a rounded chat list card and a
 * rounded conversation card on a warm backdrop. On phones one card shows at
 * a time: the list at /chat, the conversation at /chat/:roomId.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const { roomId } = useParams();
  const onOpen = useNewChatStore((s) => s.onOpen);

  return (
    <div className="flex h-dvh w-full gap-3 p-0 md:p-3">
      <nav className="hidden w-14 shrink-0 flex-col items-center gap-3 py-2 md:flex">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl shadow-sm">
          <MessagesSquare className="size-5" />
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="size-11 rounded-2xl"
          aria-label="New chat"
          onClick={() => onOpen()}
        >
          <SquarePen />
        </Button>
        <div className="mt-auto flex flex-col items-center gap-2">
          <ConnectionBadge compact />
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <aside
        className={cn(
          "bg-card w-full shrink-0 overflow-hidden border shadow-sm md:block md:w-88 md:rounded-3xl",
          roomId ? "hidden" : "block",
        )}
      >
        <Sidebar />
      </aside>

      <main
        className={cn(
          "bg-card min-w-0 flex-1 overflow-hidden border shadow-sm md:flex md:rounded-3xl",
          roomId ? "flex" : "hidden",
        )}
      >
        {children}
      </main>
    </div>
  );
}
