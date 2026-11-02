import type { Me } from "@/features/users/types/user";
import { apiClient } from "@/lib/api/client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
}

// Better Auth endpoints (not enveloped), mounted at /api/auth/*.
export const authApi = {
  getSession: {
    call: async (): Promise<Me | null> => {
      const { data } = await apiClient.get<{ user?: AuthUser } | null>(
        "/api/auth/get-session",
      );
      return data?.user ? { ...data.user, image: data.user.image ?? null } : null;
    },
  },
  signIn: {
    call: (input: SignInInput) =>
      apiClient.post("/api/auth/sign-in/email", input),
  },
  signUp: {
    call: (input: SignUpInput) =>
      apiClient.post("/api/auth/sign-up/email", input),
  },
  signOut: {
    call: () => apiClient.post("/api/auth/sign-out", {}),
  },
};
