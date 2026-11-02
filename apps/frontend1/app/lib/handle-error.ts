import { toast } from "sonner";

const DEFAULT_MESSAGE = "An unexpected error occurred";

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
    // Kyu envelope: { success: false, error: { message, details } }
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
  const message = getErrorMessage(error);
  const finalMessage = action
    ? `Error occurred while trying to ${action}: ${message}`
    : message;

  toast.error(finalMessage);
};
