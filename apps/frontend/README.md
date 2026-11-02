# Kyu Chatter — web app (Aurora)

React Router (SPA) + Tailwind 4 + shadcn/ui frontend for `apps/backend`.
Contract: [`docs/API.md`](../../docs/API.md).

```bash
pnpm install
cp .env.example .env     # VITE_API_BASE_URL -> backend, default http://localhost:3000
pnpm dev                 # http://localhost:5173  (set backend FRONTEND_URL to match)
pnpm typecheck && pnpm lint && pnpm build
```

Dev login: with `ALLOW_DEV_USER_HEADER=true` on the backend, the sign-in page has a
"dev login" box that acts as any user id (no password).

## Layout

```text
app/
├── routes/       Thin route files (flat routes): auth.*, chat, chat.$roomId
├── features/     One folder per area: auth, rooms, messages, realtime, presence, users, media
│   └── <name>/{api,components,hooks,schemas,stores,types,utils}
├── components/   ui/ (shadcn), layout/ (shell, sidebar), states/ (loading, 404, errors)
├── providers/    theme, realtime (socket lifetime), drawer (global dialogs)
├── hooks/  lib/  generic hooks; axios client, query keys, helpers
├── root.tsx  routes.ts  styles.css
```

State: server data in React Query; socket events write straight into its cache
(`features/realtime/hooks/use-realtime-events.ts`); UI/ephemeral state in zustand.

`apps/frontend1` is the same app with a different look.
