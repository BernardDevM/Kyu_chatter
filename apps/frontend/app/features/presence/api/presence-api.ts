import { apiClient } from "@/lib/api/client";

import type { Presence, PresenceResponse } from "../types/presence";

export const presenceApi = {
  query: {
    call: async (userIds: string[]): Promise<Record<string, Presence>> => {
      const { data } = await apiClient.get<PresenceResponse>("/api/presence", {
        params: { userIds: userIds.join(",") },
      });
      return Object.fromEntries(
        Object.entries(data).map(([id, v]) => [
          id,
          { online: v.status === "ONLINE", lastSeenAt: v.lastSeenAt ?? null },
        ]),
      );
    },
  },
};
