import { Outlet } from "react-router";

import { ChatShell } from "@/components/layout/chat-shell";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { DrawerProvider } from "@/providers/drawer-provider";
import { RealtimeProvider } from "@/providers/realtime-provider";

export const meta = () => [{ title: "Chats · Kyu Chatter" }];

export default function ChatLayout() {
  return (
    <RouteGuard>
      <RealtimeProvider>
        <ChatShell>
          <Outlet />
        </ChatShell>
        <DrawerProvider />
      </RealtimeProvider>
    </RouteGuard>
  );
}
