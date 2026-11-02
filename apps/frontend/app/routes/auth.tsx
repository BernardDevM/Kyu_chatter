import { Outlet } from "react-router";

import { GuestGuard } from "@/features/auth/components/route-guard";

export default function AuthLayout() {
  return (
    <GuestGuard>
      <Outlet />
    </GuestGuard>
  );
}
