import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUserSessionStore } from "@/features/auth/stores/user-session-store";
import { handleError } from "@/lib/handle-error";
import { queryKeys } from "@/lib/query-keys";

import { usersApi } from "./users-api";

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: () => usersApi.search.call(q.trim()),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const devUserId = useUserSessionStore((s) => s.devUserId);
  return useMutation({
    mutationFn: usersApi.update.call,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.session(devUserId) }),
    onError: (e) => handleError(e, "update your profile"),
  });
}
