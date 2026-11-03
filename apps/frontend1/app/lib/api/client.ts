import axios from "axios";

import { useUserSessionStore } from "@/features/auth/stores/user-session-store";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// One axios instance for the NestJS backend. Cookies carry the Better Auth
// session. When the browser refuses cross-site cookies (frontend and API on
// different sites), the bearer token the API returns on sign-in is sent instead.
// In dev the `x-dev-user-id` header can stand in for either.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const { devUserId, authToken } = useUserSessionStore.getState();
  if (devUserId) config.headers.set("x-dev-user-id", devUserId);
  if (authToken) config.headers.set("Authorization", `Bearer ${authToken}`);
  return config;
});

// Domain endpoints wrap payloads in { success, data, meta }. Unwrap so
// callers get the payload; Better Auth and health responses pass through.
apiClient.interceptors.response.use((response) => {
  const token = response.headers["set-auth-token"];
  if (typeof token === "string" && token) {
    useUserSessionStore.getState().setAuthToken(token);
  }
  const body = response.data;
  if (
    body &&
    typeof body === "object" &&
    body.success === true &&
    "data" in body
  ) {
    response.data = body.data;
  }
  return response;
});
