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
 * One continuous card on a warm backdrop: a slim icon rail, the chat list and
 * the conversation share a single rounded surface, split by hairline dividers.
 * On phones one pane shows at a time: the list at /chat, the conversation at
 * /chat/:roomId.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const { roomId } = useParams();
  const onOpen = useNewChatStore((s) => s.onOpen);

  return (
    <div className="h-dvh w-full p-0 md:p-3">
      <div className="bg-card flex h-full w-full overflow-hidden border shadow-sm md:rounded-[2rem]">
        <nav className="bg-rail text-rail-foreground hidden w-16 shrink-0 flex-col items-center gap-4 py-5 md:flex">
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
            "w-full shrink-0 overflow-hidden md:block md:w-88 md:border-r",
            roomId ? "hidden" : "block",
          )}
        >
          <Sidebar />
        </aside>

        <main
          className={cn(
            "min-w-0 flex-1 overflow-hidden md:flex",
            roomId ? "flex" : "hidden",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
