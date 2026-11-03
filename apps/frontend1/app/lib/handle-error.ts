import { toast } from "sonner";

const DEFAULT_MESSAGE = "An unexpected error occurred";

// Better Auth sends { code, message }. Map the codes people actually hit.
const AUTH_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email or password is incorrect.",
  USER_ALREADY_EXISTS:
    "An account with this email already exists. Sign in instead.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters for your password.",
  INVALID_EMAIL: "Enter a valid email address.",
};

// A usable message: a non-empty string, or a list of them (NestJS
// validation errors send `message: string[]`).
function asMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const parts = value.filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    );
    return parts.length ? parts.join(", ") : undefined;
  }
  return undefined;
}

/** The most useful message we can dig out of an API (or any) error. */
export function getErrorMessage(error: any): string {
  return (
    asMessage(error) ??
    // Wrapped API response: { response: { message } } or { response: "..." }
    asMessage(error?.response?.data?.response?.message) ??
    asMessage(error?.response?.data?.response) ??
    // API envelope: { success: false, error: { message, details } }
    asMessage(error?.response?.data?.error?.details) ??
    asMessage(error?.response?.data?.error?.message) ??
    // NestJS: { message: "..." | ["..."], error: "Bad Request" }
    asMessage(error?.response?.data?.message) ??
    asMessage(error?.response?.message) ??
    // Plain Error / axios network error
    asMessage(error?.message) ??
    // Some APIs return error.error as the message
    asMessage(error?.error) ??
    DEFAULT_MESSAGE
  );
}

// Shows a toast with the most useful message we can dig out of an API error.
export const handleError = (error: any, action?: string) => {
  const code = error?.response?.data?.code;
  // axios sets no response when the API is down, blocked by CORS, or timed out.
  const unreachable = error?.isAxiosError && !error.response;

  const message = unreachable
    ? "Can't reach the server. Check your connection and the API URL."
    : (AUTH_MESSAGES[code] ?? getErrorMessage(error));

  toast.error(action ? `Could not ${action}: ${message}` : message);
};
