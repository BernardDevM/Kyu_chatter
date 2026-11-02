import type { ReactNode } from "react";

import { useRealtimeEvents } from "@/features/realtime/hooks/use-realtime-events";
import { useRoomSubscriptions } from "@/features/realtime/hooks/use-room-subscriptions";

// Mounted once inside the signed-in area: owns the socket for its lifetime.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  useRealtimeEvents();
  useRoomSubscriptions();
  return <>{children}</>;
}
