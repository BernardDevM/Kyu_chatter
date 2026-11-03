import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserSessionState {
  /** Dev-only identity sent as `x-dev-user-id` (backend ALLOW_DEV_USER_HEADER). */
  devUserId: string | null;
  setDevUserId: (id: string | null) => void;
  /** Better Auth bearer token, used when the browser drops cross-site cookies. */
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
}

export const useUserSessionStore = create<UserSessionState>()(
  persist(
    (set) => ({
      devUserId: null,
      setDevUserId: (devUserId) => set({ devUserId }),
      authToken: null,
      setAuthToken: (authToken) => set({ authToken }),
    }),
    { name: "kyu-session" },
  ),
);
