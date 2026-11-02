import type { Room, RoomDetail } from "../types/room";

/** Direct rooms have no name: show the other member. */
export function getRoomTitle(
  room: Pick<Room, "type" | "name">,
  detail: RoomDetail | undefined,
  meId: string | undefined,
): string {
  if (room.name) return room.name;
  if (room.type === "DIRECT") {
    const other = detail?.members?.find((m) => m.userId !== meId);
    return other?.user.name ?? "Direct message";
  }
  return "Untitled room";
}

export function getDirectPeerId(
  detail: RoomDetail | undefined,
  meId: string | undefined,
) {
  return detail?.members?.find((m) => m.userId !== meId)?.userId;
}

/** Pinned first, then most recent activity. */
export function sortRooms(rooms: Room[]): Room[] {
  const getIsPinned = (r: Room) =>
    Boolean(
      r.preference?.isPinned ??
        (r as unknown as { preferences?: { isPinned?: boolean } }).preferences?.isPinned,
    );

  return [...rooms].sort(
    (a, b) =>
      Number(getIsPinned(b)) - Number(getIsPinned(a)) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}
