import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/lib/query-keys";

import { usePresenceStore } from "../stores/presence-store";
import { presenceApi } from "./presence-api";

/** Seed the presence store for these users; live changes arrive over the socket. */
export function usePresenceFor(userIds: string[]) {
  const ids = [...new Set(userIds)].slice(0, 100).sort();
  const key = ids.join(",");
  const setMany = usePresenceStore((s) => s.setMany);

  const query = useQuery({
    queryKey: queryKeys.presence(key),
    queryFn: () => presenceApi.query.call(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data) setMany(query.data);
  }, [query.data, setMany]);
}

export function usePresence(userId: string | undefined) {
  return usePresenceStore((s) => (userId ? s.byUser[userId] : undefined));
}
