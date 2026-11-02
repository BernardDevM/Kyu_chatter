import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthService } from "@/features/auth/api/use-auth-service";
import { UserAvatar } from "@/features/users/components/user-avatar";
import { useProfileDialogStore } from "@/features/users/stores/profile-dialog-store";

import { ThemeToggle } from "./theme-toggle";

export function UserMenu() {
  const { session, signOut } = useAuthService();
  const onOpenProfile = useProfileDialogStore((s) => s.onOpen);
  const navigate = useNavigate();
  const me = session.data;
  if (!me) return null;

  return (
    <div className="flex items-center gap-1 border-t p-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-sidebar-accent/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none">
          <UserAvatar name={me.name} image={me.image} userId={me.id} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {me.email ?? me.id}
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem onClick={onOpenProfile}>
            <Settings /> Edit profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
      <ThemeToggle />
    </div>
  );
}
