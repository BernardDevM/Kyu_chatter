import type { ReactNode } from "react";
import { useParams } from "react-router";

import { cn } from "@/lib/utils";

import { Sidebar } from "./sidebar";

/**
 * Three-pane chat frame. On phones only one pane shows at a time: the room
 * list at /chat, the conversation at /chat/:roomId.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const { roomId } = useParams();
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground w-full shrink-0 border-r md:block md:w-80 lg:w-88",
          roomId ? "hidden" : "block",
        )}
      >
        <Sidebar />
      </aside>
      <main className={cn("min-w-0 flex-1 md:flex", roomId ? "flex" : "hidden")}>
        {children}
      </main>
    </div>
  );
}
