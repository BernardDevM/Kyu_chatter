import { useCallback, useEffect, useRef } from "react";

import { emitQuiet, WS_CLIENT } from "../lib/socket";

const REPEAT_MS = 3_000;
const IDLE_MS = 2_500;

/** Emits typing:start (throttled) while the user types and typing:stop when they pause. */
export function useTypingEmitter(roomId: string) {
  const lastStart = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);

  const stop = useCallback(() => {
    clearTimeout(idle.current);
    if (!active.current) return;
    active.current = false;
    emitQuiet(WS_CLIENT.TYPING_STOP, { roomId });
  }, [roomId]);

  const notify = useCallback(() => {
    const now = Date.now();
    if (!active.current || now - lastStart.current > REPEAT_MS) {
      active.current = true;
      lastStart.current = now;
      emitQuiet(WS_CLIENT.TYPING_START, { roomId });
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(stop, IDLE_MS);
  }, [roomId, stop]);

  useEffect(() => stop, [stop]);

  return { notify, stop };
}
