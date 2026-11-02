// One place for React Query keys so cache updates from socket events and
// mutations always hit the same entries.
export const queryKeys = {
  session: (devUserId: string | null) => ["session", devUserId] as const,
  rooms: ["rooms"] as const,
  room: (roomId: string) => ["rooms", roomId] as const,
  messages: (roomId: string) => ["messages", roomId] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  presence: (ids: string) => ["presence", ids] as const,
};
