import axios from "axios";

import { useUserSessionStore } from "@/features/auth/stores/user-session-store";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// One axios instance for the NestJS backend. Cookies carry the Better Auth
// session; in dev the `x-dev-user-id` header can stand in for it.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const devUserId = useUserSessionStore.getState().devUserId;
  if (devUserId) config.headers.set("x-dev-user-id", devUserId);
  return config;
});

// Domain endpoints wrap payloads in { success, data, meta }. Unwrap so
// callers get the payload; Better Auth and health responses pass through.
apiClient.interceptors.response.use((response) => {
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
