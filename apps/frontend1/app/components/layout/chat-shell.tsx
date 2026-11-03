import { SquarePen } from "lucide-react";
import type { ReactNode } from "react";
import { useParams } from "react-router";

import { KyuMark } from "@/components/brand/kyu-mark";
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
      <nav className="bg-rail text-rail-foreground hidden w-16 shrink-0 flex-col items-center gap-4 rounded-[2rem] py-5 md:flex">
        <KyuMark className="text-signal size-8" />
        <Button
          size="icon"
          className="bg-signal text-signal-foreground hover:bg-signal/90 size-11"
          aria-label="New chat"
          onClick={() => onOpen()}
        >
          <SquarePen />
        </Button>
        <div className="mt-auto flex flex-col items-center gap-2 [&_[data-slot=button]]:text-inherit [&_[data-slot=button]:hover]:bg-white/10 [&_[data-slot=button]:hover]:text-inherit">
          <ConnectionBadge compact />
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <aside
        className={cn(
          "bg-card w-full shrink-0 overflow-hidden border shadow-sm md:block md:w-88 md:rounded-[2rem]",
          roomId ? "hidden" : "block",
        )}
      >
        <Sidebar />
      </aside>

      <main
        className={cn(
          "bg-card min-w-0 flex-1 overflow-hidden border shadow-sm md:flex md:rounded-[2rem]",
          roomId ? "flex" : "hidden",
        )}
      >
        {children}
      </main>
    </div>
  );
}
