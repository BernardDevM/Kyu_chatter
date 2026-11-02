import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Users } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { usePresence } from "@/features/presence/api/use-presence-service";
import { UserAvatar } from "@/features/users/components/user-avatar";

import type { RoomDetail } from "../types/room";
import { getDirectPeerId, getRoomTitle } from "../utils/room-title";
import { RoomMenu } from "./room-menu";

export function RoomHeader({
  room,
  onToggleMembers,
}: {
  room: RoomDetail;
  onToggleMembers: () => void;
}) {
  const me = useCurrentUser();
  const title = getRoomTitle(room, room, me?.id);
  const peerId = getDirectPeerId(room, me?.id);
  const peer = room.members?.find((m) => m.userId === peerId)?.user;
  const presence = usePresence(peerId);
  const myRole = room.members?.find((m) => m.userId === me?.id)?.role;

  const subtitle =
    room.type === "GROUP"
      ? `${room.memberCount} members`
      : presence?.online
        ? "Online"
        : presence?.lastSeenAt
          ? `Last seen ${formatDistanceToNow(new Date(presence.lastSeenAt), { addSuffix: true })}`
          : "Offline";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" asChild>
        <Link to="/chat" aria-label="Back to chats">
          <ArrowLeft />
        </Link>
      </Button>
      <UserAvatar
        name={title}
        image={room.type === "DIRECT" ? (peer?.image ?? room.image) : room.image}
        userId={peerId}
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        aria-label="Toggle members"
        onClick={onToggleMembers}
      >
        <Users />
      </Button>
      <RoomMenu room={room} myRole={myRole} />
    </header>
  );
}
