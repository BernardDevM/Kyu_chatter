import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { usersApi } from "@/features/users/api/users-api";
import type { Me } from "@/features/users/types/user";
import { handleError } from "@/lib/handle-error";
import { queryKeys } from "@/lib/query-keys";

import { useUserSessionStore } from "../stores/user-session-store";
import { authApi, type SignInInput, type SignUpInput } from "./auth-api";

const SESSION_NOT_KEPT =
  "You signed in, but the browser did not keep the session. Check CORS and cookie settings on the API.";

export function useAuthService() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const devUserId = useUserSessionStore((s) => s.devUserId);
  const setDevUserId = useUserSessionStore((s) => s.setDevUserId);
  const setAuthToken = useUserSessionStore((s) => s.setAuthToken);

  // Dev identity -> /api/users/me with the dev header; otherwise the cookie session.
  const session = useQuery({
    queryKey: queryKeys.session(devUserId),
    queryFn: () =>
      devUserId ? usersApi.me.call() : authApi.getSession.call(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  // A real login replaces any leftover dev identity (it would keep the session
  // query on the dev header), and a dropped cookie is reported instead of ignored.
  const requireSession = async (): Promise<Me> => {
    const user = await authApi.getSession.call();
    if (!user) throw new Error(SESSION_NOT_KEPT);
    return user;
  };

  const enterApp = (user: Me, message: string) => {
    setDevUserId(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    queryClient.setQueryData(queryKeys.session(null), user);
    toast.success(message);
    navigate("/chat", { replace: true });
  };

  const firstName = (user: Me) => user.name.trim().split(/\s+/)[0] || user.name;

  const signIn = useMutation({
    mutationFn: async (input: SignInInput) => {
      await authApi.signIn.call(input);
      return requireSession();
    },
    onSuccess: (user) => enterApp(user, `Welcome back, ${firstName(user)}`),
    onError: (e) => handleError(e),
  });

  const signUp = useMutation({
    mutationFn: async (input: SignUpInput) => {
      await authApi.signUp.call(input);
      return requireSession();
    },
    onSuccess: (user) =>
      enterApp(user, `Account created. Welcome, ${firstName(user)}`),
    onError: (e) => handleError(e),
  });

  const signInWithGoogle = useMutation({
    mutationFn: authApi.signInWithGoogle.call,
    onSuccess: (url) => {
      setDevUserId(null);
      window.location.assign(url);
    },
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
      setAuthToken(null);
      queryClient.clear();
    },
    onError: (e) => handleError(e),
  });

  return { session, signIn, signUp, signInWithGoogle, devSignIn, signOut };
}
