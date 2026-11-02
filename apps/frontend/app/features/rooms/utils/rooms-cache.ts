import type { Message } from "@/features/messages/types/message";

import type { Room } from "../types/room";

export function applyNewMessage(
  rooms: Room[] | undefined,
  msg: Message,
  incrementUnread: boolean,
): Room[] | undefined {
  if (!rooms) return rooms;
  return rooms.map((r) =>
    r.id !== msg.roomId
      ? r
      : {
          ...r,
          lastMessage: {
            id: msg.id,
            senderId: msg.senderId,
            body: msg.body,
            createdAt: msg.createdAt,
          },
          updatedAt: msg.createdAt,
          unreadCount: incrementUnread ? r.unreadCount + 1 : r.unreadCount,
        },
  );
}

export function clearUnread(rooms: Room[] | undefined, roomId: string) {
  return rooms?.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r));
}

export function upsertRoom(rooms: Room[] | undefined, room: Room) {
  if (!rooms) return [room];
  return rooms.some((r) => r.id === room.id)
    ? rooms.map((r) => (r.id === room.id ? { ...r, ...room } : r))
    : [room, ...rooms];
}
