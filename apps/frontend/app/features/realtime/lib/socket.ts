import { io, type Socket } from "socket.io-client";

import { useUserSessionStore } from "@/features/auth/stores/user-session-store";
import { API_BASE_URL } from "@/lib/api/client";

// Event names mirror docs/API.md (section 9).
export const WS_CLIENT = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  MESSAGE_SEND: "message:send",
  MESSAGE_READ: "message:read",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  HEARTBEAT: "presence:heartbeat",
} as const;

export const WS_SERVER = {
  MESSAGE_NEW: "message:new",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_READ: "message:read",
  REACTION_UPDATED: "reaction:updated",
  TYPING: "typing",
  PRESENCE_UPDATE: "presence:update",
  ROOM_UPDATED: "room:updated",
  MEMBER_JOINED: "member:joined",
  MEMBER_LEFT: "member:left",
  ERROR: "error",
} as const;

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket) return socket;
  const { devUserId, authToken } = useUserSessionStore.getState();
  socket = io(API_BASE_URL, {
    transports: ["websocket"],
    withCredentials: true,
    auth: {
      ...(authToken ? { token: authToken } : {}),
      ...(devUserId ? { userId: devUserId } : {}),
    },
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Emit with an ack; rejects on timeout or `{ ok: false }`. */
export function emitWithAck<T>(
  event: string,
  payload?: unknown,
  timeoutMs = 10_000,
): Promise<T> {
  const s = socket;
  if (!s?.connected) return Promise.reject(new Error("Socket not connected"));
  return s
    .timeout(timeoutMs)
    .emitWithAck(event, payload)
    .then((res: { ok?: boolean; data?: T; message?: string } & T) => {
      if (res && res.ok === false) throw new Error(res.message ?? "Request failed");
      return (res?.data ?? res) as T;
    });
}

/** Fire-and-forget emit (typing, heartbeat). No-op while disconnected. */
export function emitQuiet(event: string, payload?: unknown) {
  if (socket?.connected) socket.emit(event, payload);
}
