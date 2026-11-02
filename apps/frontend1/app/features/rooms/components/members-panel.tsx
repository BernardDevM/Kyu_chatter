import { MoreHorizontal, UserPlus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { usePresenceFor } from "@/features/presence/api/use-presence-service";
import { UserAvatar } from "@/features/users/components/user-avatar";
import type { UserSummary } from "@/features/users/types/user";

import { useAddMembers, useRemoveMember } from "../api/use-room-service";
import type { RoomDetail } from "../types/room";
import { UserPicker } from "./user-picker";

export function MembersPanel({ room }: { room: RoomDetail }) {
  const me = useCurrentUser();
  const members = room.members ?? [];
  const myRole = members.find((m) => m.userId === me?.id)?.role;
  const canManage = room.type === "GROUP" && (myRole === "OWNER" || myRole === "ADMIN");
  const removeMember = useRemoveMember(room.id);
  const addMembers = useAddMembers(room.id);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<UserSummary[]>([]);

  usePresenceFor(members.map((m) => m.userId));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-1 border-b p-6 pt-10">
        <h2 className="font-display truncate text-xl font-semibold">{room.name ?? "Members"}</h2>
        {room.description && (
          <p className="text-muted-foreground text-sm">{room.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Members · {members.length}
        </span>
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <UserPlus /> Add
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-0.5 px-2 pb-3">
          {members.map((m) => (
            <li
              key={m.userId}
              className="hover:bg-muted flex items-center gap-2.5 rounded-xl px-2 py-1.5"
            >
              <UserAvatar name={m.user.name} image={m.user.image} userId={m.userId} />
              <span className="flex-1 truncate text-sm">
                {m.user.name}
                {m.userId === me?.id && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </span>
              {m.role !== "MEMBER" && (
                <Badge variant="secondary" className="text-[10px]">
                  {m.role.toLowerCase()}
                </Badge>
              )}
              {canManage && m.userId !== me?.id && m.role !== "OWNER" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => removeMember.mutate(m.userId)}
                    >
                      Remove from group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      </ScrollArea>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add people</DialogTitle>
          </DialogHeader>
          <UserPicker
            selected={picked}
            onToggle={(u) =>
              setPicked((p) =>
                p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u],
              )
            }
          />
          <Button
            disabled={picked.length === 0 || addMembers.isPending}
            onClick={() =>
              addMembers.mutate(
                picked.map((p) => p.id),
                {
                  onSuccess: () => {
                    setPicked([]);
                    setAdding(false);
                  },
                },
              )
            }
          >
            Add {picked.length || ""}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
