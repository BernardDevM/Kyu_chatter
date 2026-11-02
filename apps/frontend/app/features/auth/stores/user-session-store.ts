import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserSessionState {
  /** Dev-only identity sent as `x-dev-user-id` (backend ALLOW_DEV_USER_HEADER). */
  devUserId: string | null;
  setDevUserId: (id: string | null) => void;
}

export const useUserSessionStore = create<UserSessionState>()(
  persist(
    (set) => ({
      devUserId: null,
      setDevUserId: (devUserId) => set({ devUserId }),
    }),
    { name: "kyu-session" },
  ),
);
