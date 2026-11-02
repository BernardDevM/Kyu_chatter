import {
  Archive,
  Bell,
  BellOff,
  LogOut,
  MoreVertical,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useDeleteRoom,
  useLeaveRoom,
  useRoomPreferences,
} from "../api/use-room-service";
import type { MemberRole, Room } from "../types/room";

export function RoomMenu({ room, myRole }: { room: Room; myRole?: MemberRole }) {
  const navigate = useNavigate();
  const prefs = useRoomPreferences(room.id);
  const leave = useLeaveRoom();
  const remove = useDeleteRoom();
  const preference =
    room.preference ??
    (room as unknown as { preferences?: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean } }).preferences;
  const { isMuted = false, isPinned = false, isArchived = false } = preference ?? {};
  const goBack = () => navigate("/chat");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Room options">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => prefs.mutate({ isPinned: !isPinned })}>
          {isPinned ? <PinOff /> : <Pin />}
          {isPinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => prefs.mutate({ isMuted: !isMuted })}>
          {isMuted ? <Bell /> : <BellOff />}
          {isMuted ? "Unmute" : "Mute"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => prefs.mutate({ isArchived: !isArchived })}>
          <Archive />
          {isArchived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        {room.type === "GROUP" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => leave.mutate(room.id, { onSuccess: goBack })}
            >
              <LogOut />
              Leave group
            </DropdownMenuItem>
            {myRole === "OWNER" && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => remove.mutate(room.id, { onSuccess: goBack })}
              >
                <Trash2 />
                Delete group
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
