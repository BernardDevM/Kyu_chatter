import { useEffect, useRef } from "react";

import { useRoomsQuery } from "@/features/rooms/api/use-room-service";

import { emitQuiet, WS_CLIENT } from "../lib/socket";
import { useConnectionStore } from "../stores/connection-store";

/** Join the socket room of every room in the list (also new ones as they appear). */
export function useRoomSubscriptions() {
  const { data: rooms } = useRoomsQuery();
  const status = useConnectionStore((s) => s.status);
  const joined = useRef(new Set<string>());

  useEffect(() => {
    if (status !== "connected") {
      joined.current.clear(); // a new connection must re-join
      return;
    }
    for (const room of rooms ?? []) {
      if (joined.current.has(room.id)) continue;
      joined.current.add(room.id);
      emitQuiet(WS_CLIENT.ROOM_JOIN, { roomId: room.id });
    }
  }, [rooms, status]);
}
