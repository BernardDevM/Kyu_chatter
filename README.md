# Kyu Chatter

A real-time chat application built as a **distributed system**: several stateless server nodes sit behind a load
balancer, share state through Redis and Postgres, and keep working when one node dies.

If you have never contributed to a project like this, start with
[Contributing](#contributing) and the [good first tasks](#good-first-tasks).

> **Heads up:** the backend API is currently a set of **validated placeholders**. Routes exist, requests are
> validated, responses have the right shape, but services return sample data instead of reading the database.
> Replacing those placeholders with real logic is the main work available. See [Project status](#project-status).

---

## Table of contents

1. [What it does](#what-it-does)
2. [Project status](#project-status)
3. [Architecture (top to bottom)](#architecture-top-to-bottom)
4. [Tech stack](#tech-stack)
5. [Data model](#data-model)
6. [Repository structure](#repository-structure)
7. [Getting started](#getting-started)
8. [Working with the API](#working-with-the-api)
9. [Contributing](#contributing)
10. [Troubleshooting](#troubleshooting)
11. [Roadmap](#roadmap)

---

## What it does

- Sign in with an email one-time code (OTP) and/or passwords.
- Group rooms and private 1-to-1 chats.
- Real-time messages, typing indicators and online/offline status over WebSockets.
- Replies, edits, soft-deletes, emoji reactions and read tracking.
- Image, video and file sharing (direct-to-Cloudinary/Cloudflare uploads).
- Two or more server nodes: kill one, clients reconnect to another and catch up on missed messages.

## Project status

| Area | State |
|---|---|
| Database schema and migrations (Neon + Prisma) | **Done** |
| REST routes, request DTOs (validation), response shapes | **Done (placeholders)** |
| Global pipe, response envelope, error filter, logging | **Done** |
| Swagger UI and `docs/API.md` | **Done** |
| WebSocket gateway (event names + payload DTOs) | **Stub**, acks only |
| Service logic (Prisma queries, permission checks) | **To do**, search for `TODO(impl)` |
| Authentication (Better Auth + email OTP) | **To do**, packages installed, not wired |
| OTP email sending (Resend) | **In progress**, owned by another contributor |
| Guards, rate limiting, security middleware | **To do** |
| Redis (Socket.IO adapter, presence, rate-limit counters) | **To do** |
| Docker Compose, Traefik, Nginx | **To do** |
| Frontend (React) | **To do**, only the Vite starter template exists |

## Architecture (top to bottom)

> This section describes the **target design**. Check [Project status](#project-status) to see what is built.

### The big picture

```mermaid
flowchart TB
  subgraph Clients
    W["React web app (browser)"]
  end
  subgraph Edge["Edge layer"]
    N["Nginx: serves the built React app"]
    T["Traefik: load balancer, health checks, edge rate limit"]
  end
  subgraph API["API layer: stateless NestJS nodes"]
    A1["api-node-1"]
    A2["api-node-2"]
  end
  R[("Redis: Socket.IO backplane, presence, rate-limit counters")]
  P[("Neon Postgres via Prisma: users, sessions, rooms, messages")]
  C["Cloudinary: media storage"]
  M["Resend: OTP emails"]

  W -->|static files| N
  W -->|"HTTPS and WebSocket"| T
  T --> A1
  T --> A2
  A1 <--> R
  A2 <--> R
  A1 --> P
  A2 --> P
  A1 -.-> C
  A2 -.-> C
  A1 -.-> M
  A2 -.-> M
```

Read it from the top:

1. **Clients** (the React app) load static files from Nginx, then talk to the API through Traefik only.
2. **Edge layer.** Traefik spreads requests and WebSocket connections across the API nodes, removes a node from
   rotation when its `/health/ready` check fails, and applies a first, coarse rate limit. Nginx only serves the
   built frontend.
3. **API layer.** Every node runs the same NestJS code and keeps **no state in memory** that another node would
   need: no room membership, no sessions, no presence, no counters. Any node can serve any user.
4. **Shared state.** Two stores hold everything that must survive or be shared:
   - **Redis** carries real-time traffic between nodes (Socket.IO Redis adapter), online/offline presence, and
     rate-limit counters.
   - **Postgres (Neon)** is the source of truth: accounts, sessions, rooms, memberships, messages, media records.
5. **External services.** Cloudinary stores uploaded files; Resend delivers the OTP emails.

### Inside one API node: the request pipeline

```
Request
  -> Global ValidationPipe        reject unknown or invalid fields (DTOs)
  -> Controller                   routing only, no business logic
  -> Service                      business rules + Prisma queries
  -> TransformResponseInterceptor wraps { success, data, meta: { nodeId, timestamp } } + X-Node-Id header
  -> Response

Any thrown error
  -> AllExceptionsFilter          uniform { success: false, error: {...} }, Prisma errors mapped (409, 404)
```

Auth routes (`/api/auth/*`), health routes and Swagger skip the envelope.

### Flow 1: sending a message across nodes

```mermaid
sequenceDiagram
  participant A as Client A (on node-1)
  participant N1 as API node-1
  participant DB as Postgres
  participant R as Redis
  participant N2 as API node-2
  participant B as Client B (on node-2)
  A->>N1: message:send (roomId, clientMessageId, body)
  N1->>N1: validate, check membership, check rate limit
  N1->>DB: insert message (idempotent on clientMessageId)
  N1-->>A: ack (saved id, createdAt)
  N1->>R: publish to the room channel
  R->>N2: deliver to subscribed nodes
  N2->>B: message:new
```

Rules that make this safe:
- **Persist first, then broadcast.** A message is never announced before it is saved.
- **Idempotent sends.** The client invents a `clientMessageId`. A unique index on
  `(roomId, senderId, clientMessageId)` means a retry after a dropped connection can never create a duplicate.
- Every message stores the `nodeId` that handled it, so the UI can show which node served a message during demos.

### Flow 2: a node dies (failover)

1. Traefik's health check fails for `node-1` and stops routing to it.
2. Socket.IO clients on `node-1` lose their connection and auto-reconnect (with backoff) to `node-2`.
3. The session cookie is validated against Postgres, so **no re-login** is needed.
4. The client calls the resync endpoint/event with the last message id it saw per room and receives everything it
   missed from Postgres. Nothing is lost because messages were persisted before being broadcast.
5. Presence uses a Redis sorted set with expiry times, so users from the dead node expire to "offline" on their own.

### Flow 3: signing in (email OTP)

1. The user enters an email. Better Auth generates a short-lived code and calls our mail function (Resend).
2. The user submits the code. Better Auth creates a session row in Postgres and sets a cookie.
3. Every HTTP request and the WebSocket handshake read that cookie. Because sessions live in the database,
   any node can authenticate any user.

### Flow 4: presence and typing

- **Presence:** each socket heartbeats into a Redis sorted set `presence:{userId}`. A user is online if any
  non-expired entry exists. When the last socket leaves, `lastSeenAt` is written to Postgres.
- **Typing:** short-lived events broadcast through the Redis adapter. They are never written to the database.

### Flow 5: media uploads

1. Client asks `POST /api/media/signature`, the API creates a `Media` row (`UPLOADING`) and returns a signed
   Cloudinary upload.
2. Client uploads **directly to Cloudinary** (file bytes never pass through our servers).
3. Client calls `POST /api/media/:id/confirm`; the API verifies it and marks the media `READY`.
4. The media id is attached to a message through `mediaIds`.

### Layers of rate limiting (planned)

| Layer | What it protects |
|---|---|
| Traefik / Nginx | Floods of raw requests at the edge |
| `@nestjs/throttler` (Redis-backed) | HTTP routes per IP, with much tighter limits on OTP routes |
| WebSocket throttle guard (Redis counters) | Message and typing spam per user and event |
| Better Auth rate limiting | Sign-in and OTP abuse |

### Design principles

1. Nodes are stateless; shared state lives in Redis or Postgres.
2. Persist, then broadcast.
3. Every write that can be retried is idempotent.
4. Reconnect always ends with a resync from the database.
5. Never trust the client: user ids come from the session, never from request bodies, and every room action checks
   membership.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript |
| Backend | NestJS 12, TypeScript (ESM) |
| Realtime | Socket.IO (WebSocket transport), Redis adapter |
| Auth | Better Auth (email OTP), `@thallesp/nestjs-better-auth` |
| Database | Neon Postgres, Prisma ORM 7 (`@prisma/adapter-pg`) |
| Validation | class-validator, class-transformer |
| Email | Resend (OTP only) |
| Media | Cloudinary (signed direct uploads) |
| Edge / infra | Traefik, Nginx, Docker Compose |
| Tooling | pnpm, Vitest, oxlint, Prettier, Swagger |

## Data model

```mermaid
erDiagram
  USER ||--o{ SESSION : has
  USER ||--o{ ACCOUNT : has
  USER ||--o{ ROOM_MEMBER : joins
  USER ||--o{ MESSAGE : sends
  USER ||--o{ ROOM : creates
  USER ||--o{ MEDIA : uploads
  USER ||--o{ ROOM_PREFERENCE : sets
  ROOM ||--o{ ROOM_MEMBER : has
  ROOM ||--o{ MESSAGE : contains
  ROOM ||--o{ ROOM_PREFERENCE : has
  MESSAGE ||--o{ ATTACHMENT : has
  MESSAGE ||--o{ MESSAGE_RECEIPT : has
  MESSAGE ||--o{ MESSAGE_REACTION : has
  MESSAGE |o--o{ MESSAGE : "replies to"
  MEDIA ||--o{ ATTACHMENT : "used by"
```

Key ideas:
- **User ↔ Room is many-to-many** through `RoomMember` (role: `OWNER`, `ADMIN`, `MEMBER`; plus a `lastReadMessageId` read cursor).
- A **direct message** is a `Room` with `type = DIRECT`, exactly two members and a unique `directKey` (the two user ids
  sorted and joined with `:`), which guarantees one DM per pair.
- `Message.clientMessageId` is the idempotency key; `Message.nodeId` records which server handled it; messages are
  soft-deleted via `deletedAt`.
- `Media` records an upload (`UPLOADING`, `READY`, `FAILED`); `Attachment` links media to a message.
- **Not in the database:** presence, typing state, socket ids and rate-limit counters. These live in Redis.
- Better Auth owns `user`, `session`, `account` and `verification`. **User ids are random strings, not UUIDs.**
  Room, message and media ids are time-ordered UUIDs (v7).

The full schema is in [`apps/backend/prisma/schema.prisma`](apps/backend/prisma/schema.prisma).

## Repository structure

Items marked *(planned)* do not exist yet.

```
.
├─ apps/                         The two applications
│  ├─ backend/                   NestJS API + WebSocket server (this is where most work happens)
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma        Single source of truth for all database tables
│  │  │  └─ migrations/          Generated SQL migrations. Commit them, never edit applied ones
│  │  ├─ prisma.config.ts        Prisma CLI config: schema path and the direct (unpooled) Neon URL
│  │  ├─ src/
│  │  │  ├─ main.ts              App bootstrap: CORS, Swagger, port, env loading
│  │  │  ├─ app.module.ts        Root module that wires every feature module together
│  │  │  ├─ common/              Code shared by every feature
│  │  │  │  ├─ common.module.ts  Registers the global pipe, interceptors and exception filter
│  │  │  │  ├─ decorators/       @CurrentUser() (who is calling) and @Public() (skip auth)
│  │  │  │  ├─ dto/              Shared DTOs: pagination, id params, trimString helper
│  │  │  │  ├─ filters/          AllExceptionsFilter: uniform error responses
│  │  │  │  ├─ guards/           Auth and rate-limit guards (stubs, to be built)
│  │  │  │  ├─ interceptors/     Response envelope + X-Node-Id header, request logging
│  │  │  │  └─ utils/            Small helpers, e.g. getNodeId()
│  │  │  ├─ config/              Environment validation (to be built)
│  │  │  ├─ prisma/              PrismaService/PrismaModule: the single database connection (global)
│  │  │  ├─ auth/                Better Auth setup lives here (to be wired)
│  │  │  ├─ mail/                OTP email sending via Resend (owned by another contributor)
│  │  │  ├─ users/               Profile, user search, public profiles
│  │  │  ├─ rooms/               Group/DM rooms, members, roles, preferences, read tracking
│  │  │  ├─ messages/            Message history, sending, editing, deleting, reactions, receipts, resync
│  │  │  ├─ media/               Signed upload requests, upload confirmation, media metadata
│  │  │  ├─ chat/                WebSocket gateway, socket event names, presence and typing services
│  │  │  │  └─ dto/ws/           Payload shapes for each socket event
│  │  │  ├─ realtime/            Redis connection and Socket.IO Redis adapter (to be built)
│  │  │  ├─ health/              /health/live, /health/ready, /health/node for Traefik and demos; /ping for uptime monitors
│  │  │  └─ generated/prisma/    Generated Prisma client. Git-ignored; create it with `pnpm prisma generate`
│  │  ├─ test/                   Vitest tests: DTO validation, filter, interceptor, load-test script
│  │  ├─ .env.example            Template for your local .env
│  │  └─ Dockerfile              Container build (empty, planned)
│  └─ frontend/                  React + Vite single-page app (currently the starter template)
│     └─ src/                    main.tsx (entry), App.tsx (root component), CSS
├─ docs/
│  └─ API.md                     Full REST + WebSocket contract. Build the frontend against this
├─ infra/                        (planned) Traefik and Nginx configuration
├─ docker-compose.yml            (planned) Redis, two API nodes, Traefik, Nginx
├─ .agent/skills/                (planned) Project skill file for AI coding agents
├─ package.json                  Root manifest: pins the pnpm version
└─ README.md                     You are here
```

Every backend feature folder follows the same pattern:

```
rooms/
├─ rooms.module.ts        Declares the controller and service
├─ rooms.controller.ts    HTTP routes only: bind DTOs, call the service, set status codes
├─ rooms.service.ts       Business logic and database access
└─ dto/
   ├─ *.dto.ts            Request DTOs: input validation with class-validator
   └─ *.response.ts       Response shapes returned to the frontend
```

## Getting started

### Prerequisites

- **Node.js 22.13+** (check with `node --version`)
- **pnpm 11.6+** (`pnpm --version`). Install: <https://pnpm.io/installation>. This repo uses pnpm only; do not use npm or yarn.
- **A Postgres database on [Neon](https://neon.tech)** (free). Either ask a maintainer for a shared dev database URL, or create your own free project.
- **Redis** and **Docker**: not needed yet; they arrive with the realtime work.

### 1. Clone and branch

```bash
git clone <repo-url>
cd Kyu_chatter
git switch -c feat/my-first-change
```

### 2. Backend

```bash
cd apps/backend
cp .env.example .env        # then fill in the values below
pnpm install
pnpm prisma generate        # creates src/generated/prisma (required before building)
pnpm prisma migrate deploy  # applies the existing migrations to your database
pnpm start:dev              # http://localhost:3000, auto-reloads
```

If pnpm prints a warning about ignored build scripts, run `pnpm approve-builds` and approve the Prisma packages.

**Environment variables** (`apps/backend/.env`, never commit this file):

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | now | Neon **pooled** connection string, used by the running app |
| `DIRECT_URL` | now | Neon **direct** (unpooled) string, used by Prisma migrations |
| `PORT` | now | Server port (default 3000) |
| `NODE_ID` | now | Name of this node, e.g. `node-1`; shown in the `X-Node-Id` header |
| `ALLOW_DEV_USER_HEADER` | now | `true` lets you test without logging in (see below). **Dev only** |
| `FRONTEND_URL` | now | Frontend origin for CORS, e.g. `http://localhost:5173` |
| `BETTER_AUTH_SECRET` | with auth | Random secret (`openssl rand -base64 32`); must be identical on every node |
| `BETTER_AUTH_URL` | with auth | Public base URL of the API |
| `RESEND_API_KEY`, `MAIL_FROM` | with email | Resend credentials (mail owner) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | with media | Cloudinary credentials |

### 3. Frontend

```bash
cd apps/frontend
pnpm install
pnpm dev                    # http://localhost:5173
```

### 4. Check that it works

```bash
curl localhost:3000/health/node
curl -H "x-dev-user-id: test-user" localhost:3000/api/users/me
```

Open <http://localhost:3000/api/docs> for the interactive Swagger UI.

### Useful commands (run in `apps/backend`)

| Command | What it does |
|---|---|
| `pnpm start:dev` | Run the API with auto-reload |
| `pnpm build` | Compile to `dist/` |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` | Format with Prettier |
| `pnpm prisma generate` | Regenerate the Prisma client after any schema change |
| `pnpm prisma migrate dev --name <what-changed>` | Create and apply a new migration (use a dev database) |
| `pnpm prisma studio` | Browse your database in the browser |
| `pnpm nest g mo\|co\|s <name> --no-spec` | Generate a Nest module, controller or service |

## Working with the API

- **Contract:** [`docs/API.md`](docs/API.md) lists every route, its request fields and constraints, response shape and
  error format. **Swagger UI** at `/api/docs` lets you try routes live.
- **Envelope:** successful responses look like `{ "success": true, "data": ..., "meta": { "nodeId", "timestamp" } }`.
  Errors look like `{ "success": false, "error": { "statusCode", "message", "details?", "path", "timestamp" } }`.
- **Testing without logging in (development only):** set `ALLOW_DEV_USER_HEADER=true` and send
  `x-dev-user-id: <any-id>`. Once real queries exist, that user must exist in the `user` table (create one in
  `pnpm prisma studio`). This fallback is removed when guards are added.
- **Routes live under `/api/...`** (for example `/api/rooms`). `/api/auth/*` belongs to Better Auth. Health routes are
  at `/health/*`. `/ping` answers GET, HEAD and OPTIONS with a `SELECT 1` (200/204, or 503 if the database is down)
  for uptime monitors such as UptimeRobot.

## Contributing

Everyone is welcome, including first-timers. The workflow is the same for every change.

### 1. Pick a task

Browse the [good first tasks](#good-first-tasks) below or search the code for work that is waiting:

```bash
git grep -n "TODO(impl)"
```

Each placeholder service method has a `TODO(impl)` comment describing exactly which tables to query and which rules to
enforce. Tell the team which one you are taking so two people do not do the same thing.

### 2. Create a branch

Use `type/short-description`, lowercase with hyphens:

```bash
git switch main && git pull
git switch -c feat/rooms-create-group
```

Types: `feat/` new functionality, `fix/` bug fix, `chore/` housekeeping, `docs/` documentation, `refactor/` restructuring.
One branch per task. Small branches are easier to review and merge.

### 3. Implement a placeholder (worked example)

Say you take `RoomsService.createDirectRoom`:

1. Open `apps/backend/src/rooms/rooms.service.ts` and read the `TODO(impl)` comment.
2. Inject the database: `constructor(private readonly prisma: PrismaService) {}`
   (import it with a `.js` suffix, see the conventions below).
3. Replace the sample return value with real Prisma calls. Wrap multi-step writes in `this.prisma.$transaction(...)`.
4. Keep the return value matching the response type in `dto/room.response.ts`. If you must change a response or request
   shape, update the DTO **and** `docs/API.md` in the same pull request, because the frontend depends on it.
5. Enforce the rules in the TODO (for example: both users must exist; a user cannot DM themselves).
6. Add or update a Vitest test.
7. Run `pnpm build && pnpm lint && pnpm test`.

### 4. Commit

Use short messages in the form `type(scope): what changed`:

```bash
git add -A
git commit -m "feat(rooms): implement get-or-create direct room"
```

### 5. Open a pull request

```bash
git fetch origin
git rebase origin/main            # or: git merge origin/main
git push -u origin feat/rooms-create-group
```

Then open a pull request on GitHub (or `gh pr create --base main`). In the description, say what changed, anything
reviewers must do after pulling (for example `pnpm install` or new environment variables), and anything left unfinished.
Ask a teammate to review. Merge when it builds and tests pass.

### Pull request checklist

- [ ] `pnpm build`, `pnpm lint` and `pnpm test` pass in the app you touched
- [ ] No `.env` files, secrets, `node_modules/`, `dist/` or `src/generated/` committed
- [ ] New request fields have class-validator decorators
- [ ] Contract changes are reflected in `docs/API.md`
- [ ] Prisma schema changes include a new migration in `prisma/migrations/`
- [ ] No OTP codes, tokens, cookies or message bodies written to logs

### Code conventions

- **pnpm only.** Run commands from inside the app folder you are working on.
- **ESM imports must end in `.js`**, even for TypeScript files: `import { RoomsService } from './rooms.service.js'`.
  Forgetting this is the most common build error.
- **Use the Nest CLI** (`pnpm nest g ...`) for new modules, controllers and services so they are registered for you.
- **Controllers stay thin.** Routing, DTO binding and status codes only. Logic and database access belong in services.
- **Always validate input** with a DTO. Never read a `userId` from a request body; use `@CurrentUser('id')`.
- **User ids are strings** (validate with `@IsString()`); **room, message and media ids are UUIDs** (`@IsUUID('all')`).
- **Never edit a migration that has been applied.** Change `schema.prisma` and create a new migration instead.
- **Never use raw SQL built from strings.** Use Prisma queries (or the tagged `$queryRaw`).
- **Do not store state in server memory.** If another node would need it, it belongs in Redis or Postgres.
- **Persist first, then broadcast** for anything real-time.
- Do not install `npm`/`yarn` lockfiles, and do not add dependencies without mentioning why in the pull request.

### Good first tasks

| Difficulty | Task |
|---|---|
| Beginner | Fill in `HealthController.getReady` with real database and Redis ping checks |
| Beginner | Implement `UsersService.getMe`, `updateMe`, `getProfile` and `search` with Prisma |
| Beginner | Add a Prisma seed script that creates a few demo users and rooms |
| Beginner | Improve `docs/API.md` with example requests and responses |
| Beginner | Frontend: login page with email + OTP code form |
| Intermediate | Implement `RoomsService` (create group, get-or-create DM, list with unread counts, membership checks) |
| Intermediate | Implement `MessagesService` (cursor pagination, idempotent send, soft delete, resync) |
| Intermediate | Frontend: room list, chat view and a Socket.IO client hook with reconnect and resync |
| Intermediate | Write the load-test script in `apps/backend/test/load/` and record latency numbers |
| Advanced | Wire Better Auth (`auth.ts`, Nest module, session on the WebSocket handshake) |
| Advanced | Socket.IO Redis adapter so messages cross nodes; presence with Redis sorted sets |
| Advanced | WebSocket throttle guard and `@nestjs/throttler` with Redis storage |
| Advanced | `docker-compose.yml` with Redis, two API nodes, Traefik health checks and Nginx |

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `Cannot find module '../generated/prisma/client.js'` | Run `pnpm prisma generate` |
| `Cannot find module './something'` at runtime | Missing `.js` suffix on a relative import |
| `command not found: pnpm` | Install pnpm and restart your terminal (fish users: add the pnpm `bin` folder with `fish_add_path`) |
| POST/PATCH bodies arrive empty or fail validation | The body parser is disabled in `main.ts` (`bodyParser: false`) before Better Auth is registered; keep them in sync |
| Database connection hangs or `ENETUNREACH` | Neon over IPv6; `main.ts` already prefers IPv4, make sure `.env` is loaded and the URL is correct |
| `prisma migrate dev` complains about a shadow database | Use a dedicated dev Neon branch, or use `pnpm prisma migrate deploy` to apply existing migrations |
| Build scripts ignored warning from pnpm | Run `pnpm approve-builds` |
| Browser blocks API calls | Set `FRONTEND_URL` to the exact frontend origin and restart the API |

## Roadmap

1. Real service logic for users, rooms and messages (Prisma).
2. Better Auth with email OTP; session on HTTP and WebSocket handshake.
3. Socket.IO gateway with Redis adapter: cross-node broadcast, presence, typing.
4. Frontend: auth, room list, chat view, media upload.
5. Guards, rate limiting and security hardening.
6. Docker Compose with Traefik and Nginx; two-node failover demo.
7. Load test and performance notes for the report.

## License

Academic project. A license has not been chosen yet; until one is added, all rights are reserved by the contributors.