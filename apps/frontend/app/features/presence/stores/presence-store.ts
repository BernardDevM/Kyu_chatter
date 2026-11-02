import { create } from "zustand";

import type { Presence } from "../types/presence";

interface PresenceState {
  byUser: Record<string, Presence>;
  setPresence: (userId: string, presence: Presence) => void;
  setMany: (map: Record<string, Presence>) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byUser: {},
  setPresence: (userId, presence) =>
    set((s) => ({ byUser: { ...s.byUser, [userId]: presence } })),
  setMany: (map) => set((s) => ({ byUser: { ...s.byUser, ...map } })),
}));
