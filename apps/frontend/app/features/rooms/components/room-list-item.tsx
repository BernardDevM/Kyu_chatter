import { BellOff, Pin } from "lucide-react";
import { NavLink } from "react-router";

import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { UserAvatar } from "@/features/users/components/user-avatar";
import { cn } from "@/lib/utils";

import { useRoomQuery } from "../api/use-room-service";
import type { Room } from "../types/room";
import { formatRoomTime } from "../utils/format-time";
import { getDirectPeerId, getRoomTitle } from "../utils/room-title";

export function RoomListItem({ room }: { room: Room }) {
  const me = useCurrentUser();
  // Direct rooms are named after the other member, which needs the detail.
  const { data: detail } = useRoomQuery(room.id, room.type === "DIRECT");
  const title = getRoomTitle(room, detail, me?.id);
  const peerId = getDirectPeerId(detail, me?.id);
  const peer = detail?.members?.find((m) => m.userId === peerId)?.user;
  const unread = room.unreadCount > 0;
  const preference =
    room.preference ??
    (room as unknown as { preferences?: { isPinned?: boolean; isMuted?: boolean } }).preferences;

  return (
    <NavLink
      to={`/chat/${room.id}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50",
        )
      }
    >
      <UserAvatar
        name={title}
        image={room.type === "DIRECT" ? (peer?.image ?? room.image) : room.image}
        userId={peerId}
        className="size-10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {title}
          </span>
          {preference?.isPinned && (
            <Pin className="text-muted-foreground size-3 shrink-0" />
          )}
          {preference?.isMuted && (
            <BellOff className="text-muted-foreground size-3 shrink-0" />
          )}
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
            {formatRoomTime(room.lastMessage?.createdAt ?? room.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-xs",
              unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {room.lastMessage
              ? (room.lastMessage.body ?? "Attachment")
              : "No messages yet"}
          </p>
          {unread && !preference?.isMuted && (
            <Badge className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[11px]">
              {room.unreadCount > 99 ? "99+" : room.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </NavLink>
  );
}
