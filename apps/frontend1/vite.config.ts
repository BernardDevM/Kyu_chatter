import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // The backend allows one origin (FRONTEND_URL), so keep this port stable.
  server: { port: 5174, strictPort: true },
});
