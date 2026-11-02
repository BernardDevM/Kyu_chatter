import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthService } from "@/features/auth/api/use-auth-service";
import { UserAvatar } from "@/features/users/components/user-avatar";
import { useProfileDialogStore } from "@/features/users/stores/profile-dialog-store";

/** Avatar button that opens the account menu. */
export function UserMenu() {
  const { session, signOut } = useAuthService();
  const onOpenProfile = useProfileDialogStore((s) => s.onOpen);
  const navigate = useNavigate();
  const me = session.data;
  if (!me) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <UserAvatar name={me.name} image={me.image} userId={me.id} className="size-10" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{me.name}</span>
          <span className="text-muted-foreground block truncate text-xs">{me.email ?? me.id}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenProfile}>
          <Settings /> Edit profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            signOut.mutate(undefined, {
              onSettled: () => navigate("/auth/login", { replace: true }),
            })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
