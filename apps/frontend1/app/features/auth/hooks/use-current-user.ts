import { useAuthService } from "../api/use-auth-service";

/** The signed-in user, or null/undefined while loading or signed out. */
export function useCurrentUser() {
  return useAuthService().session.data ?? null;
}
