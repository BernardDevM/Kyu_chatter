import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersApi } from "@/features/users/api/users-api";
import { handleError } from "@/lib/handle-error";
import { queryKeys } from "@/lib/query-keys";

import { useUserSessionStore } from "../stores/user-session-store";
import { authApi } from "./auth-api";

export function useAuthService() {
  const queryClient = useQueryClient();
  const devUserId = useUserSessionStore((s) => s.devUserId);
  const setDevUserId = useUserSessionStore((s) => s.setDevUserId);

  // Dev identity -> /api/users/me with the dev header; otherwise the cookie session.
  const session = useQuery({
    queryKey: queryKeys.session(devUserId),
    queryFn: () =>
      devUserId ? usersApi.me.call() : authApi.getSession.call(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const refreshSession = () => queryClient.resetQueries();

  const signIn = useMutation({
    mutationFn: authApi.signIn.call,
    onSuccess: refreshSession,
    onError: (e) => handleError(e),
  });

  const signUp = useMutation({
    mutationFn: authApi.signUp.call,
    onSuccess: refreshSession,
    onError: (e) => handleError(e),
  });

  const signInWithGoogle = useMutation({
    mutationFn: authApi.signInWithGoogle.call,
    onSuccess: (url) => window.location.assign(url),
    onError: (e) => handleError(e),
  });

  const devSignIn = (id: string) => {
    setDevUserId(id.trim());
    return queryClient.resetQueries();
  };

  const signOut = useMutation({
    mutationFn: async () => {
      if (devUserId) return;
      await authApi.signOut.call();
    },
    onSettled: () => {
      setDevUserId(null);
      queryClient.clear();
    },
    onError: (e) => handleError(e),
  });

  return { session, signIn, signUp, signInWithGoogle, devSignIn, signOut };
}
