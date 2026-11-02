import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { LoadingScreen } from "@/components/states/loading-screen";

import { useAuthService } from "../api/use-auth-service";

/** Signed-in pages: send visitors to the login page. */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { session } = useAuthService();
  if (session.isPending) return <LoadingScreen />;
  if (!session.data) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

/**
 * Login/sign-up pages: render immediately (the forms need no data) and only
 * redirect once the session check says the user is already signed in.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { session } = useAuthService();
  if (session.data) return <Navigate to="/chat" replace />;
  return <>{children}</>;
}
