import type { Config } from "@react-router/dev/config";

export default {
  // Chat is a client-only app (cookie session + WebSocket), so run as an SPA.
  ssr: false,
} satisfies Config;
