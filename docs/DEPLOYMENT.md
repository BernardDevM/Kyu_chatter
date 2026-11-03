# Deployment and Two-Node High Availability Guide

This guide explains how to configure, run, and demonstrate the distributed, multi-node Kyu Chatter backend using Docker Compose and Traefik v3.

---

## 1. Architecture Overview

The distributed deployment demonstrates high availability, statelessness, and horizontal scalability:

```
                      +-----------------------------+
                      | Frontend (Host :5173)       |
                      | VITE_API_BASE_URL:8080      |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | Traefik Load Balancer       |
                      | Ports: 8080 (API), 8081 (UI)|
                      +--------------+--------------+
                                     |
                       Round-Robin / Health Checks
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+------------------------+                       +------------------------+
| api-1 (kyu-api-1)      |                       | api-2 (kyu-api-2)      |
| Node ID: node-1        |                       | Node ID: node-2        |
| Port: 3000 (internal)  |                       | Port: 3000 (internal)  |
+-----------+------------+                       +-----------+------------+
            |                                                |
            +-----------------------+------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
    +------------------------------+  +------------------------------+
    | Neon PostgreSQL (External)   |  | Redis (kyu-redis :6379)      |
    | Shared state & auth sessions |  | Pub/Sub adapter & presence   |
    +------------------------------+  +------------------------------+
```

- **Traefik v3**: Listens on port `8080` (public API & WebSocket entrypoint) and `8081` (local dashboard). Dynamically balances traffic across `api-1` and `api-2` using active HTTP readiness checks (`/health/ready`).
- **NestJS Nodes (`api-1`, `api-2`)**: Identical stateless application containers tagging responses with `X-Node-Id` and `nodeId`.
- **Redis (`kyu-redis`)**: Inter-node message bus using `@socket.io/redis-adapter` for real-time message broadcasting and cluster-wide presence tracking.
- **Neon PostgreSQL**: Single source of truth for persistent data, accounts, and session tokens.

---

## 2. Prerequisites

- **Docker Engine & Docker Compose v2+**: Installed and running on Linux, macOS, or Windows (WSL2).
- **Node.js**: v20+ or v22+ with **pnpm** `^10` or `^11` (for host-based frontend execution).
- **External Neon Postgres Database**: Active connection strings (`DATABASE_URL` and `DIRECT_URL`).

---

## 3. Environment Configuration

The backend containers load runtime secrets from `apps/backend/.env`.

Create or verify `apps/backend/.env`:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://<user>:<password>@<neon-pooler-host>/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://<user>:<password>@<neon-direct-host>/neondb?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-32-character-secret-key-here"
BETTER_AUTH_URL="http://localhost:8080"
BETTER_AUTH_SECURE_COOKIES="false"

# Allowed Frontends
FRONTEND_URL="http://localhost:5173"
FRONTEND_URLS="http://localhost:5173"

# Redis
REDIS_URL="redis://redis:6379"
REDIS_KEY_PREFIX="kyu:"

# Development Mode
ALLOW_DEV_USER_HEADER="false"
```

> [!NOTE]
> In `docker-compose.yml`, `REDIS_URL` is automatically configured to point to `redis://redis:6379`. Both API nodes share the identical `BETTER_AUTH_SECRET` and `DATABASE_URL` ensuring seamless session interoperability across instances.

---

## 4. Starting the Compose Stack

From the repository root, start all services:

```bash
docker compose up -d --build
```

Verify that all containers are healthy:

```bash
docker compose ps
```

Expected output:
```text
NAME          IMAGE               SERVICE   STATUS                    PORTS
kyu-api-1     kyu_chatter-api-1   api-1     Up (healthy)              
kyu-api-2     kyu_chatter-api-2   api-2     Up (healthy)              
kyu-redis     redis:7-alpine      redis     Up (healthy)              0.0.0.0:6379->6379/tcp
kyu-traefik   traefik:v3.3        traefik   Up (healthy)              0.0.0.0:8080->80/tcp, 0.0.0.0:8081->8080/tcp
```

---

## 5. Starting the Frontend (Host)

The frontend runs on the host to simulate client-side traffic:

1. Configure `apps/frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8080
   ```
2. Start the Vite dev server:
   ```bash
   cd apps/frontend
   pnpm dev
   ```
   The UI will be accessible at `http://localhost:5173`.

---

## 6. Service Endpoints

| Service | URL | Purpose |
| :--- | :--- | :--- |
| **Public API Gateway** | `http://localhost:8080` | Entrypoint for all REST requests and Socket.IO |
| **Traefik Dashboard** | `http://localhost:8081` | Web UI for inspecting routers, services, and health |
| **Swagger Documentation**| `http://localhost:8080/api/docs` | Interactive OpenAPI documentation |
| **Liveness Probe** | `http://localhost:8080/health/live` | Container process health check |
| **Readiness Probe** | `http://localhost:8080/health/ready` | Deep check for DB + Redis (200 OK / 503 Service Unavailable) |
| **Node Inspection** | `http://localhost:8080/health/node` | Returns `{ nodeId, uptimeSeconds, timestamp }` |

---

## 7. Step-by-Step Failover Demonstration Script

Follow this script to demonstrate load balancing, real-time cross-node broadcast, and fault tolerance:

### Step 1: Verify Request Alternation (Round-Robin)

Send six consecutive requests to the load balancer:

```bash
for i in $(seq 1 6); do curl -s localhost:8080/health/node; echo; done
```

**Observation:**
The output alternates between `node-1` and `node-2`:
```json
{"nodeId":"node-1","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.000Z"}
{"nodeId":"node-2","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.015Z"}
{"nodeId":"node-1","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.030Z"}
{"nodeId":"node-2","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.045Z"}
{"nodeId":"node-1","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.060Z"}
{"nodeId":"node-2","uptimeSeconds":120,"timestamp":"2026-11-03T02:00:00.075Z"}
```

### Step 2: Cross-Node Realtime Broadcast

1. Open two separate browsers (or one Incognito window) to `http://localhost:5173`.
2. Log into two distinct accounts (e.g. User A and User B) who share a room.
3. Because Traefik balances connections round-robin, each client socket establishes a WebSocket connection to a different node (`api-1` and `api-2`).
4. Send a message from User A.
5. **Observation:** User B receives the message instantly via WebSocket. Inspecting the message response shows `"nodeId": "node-1"`, proving the message was ingested by `node-1` and broadcast across Redis to `node-2`.

### Step 3: Inject Failure (Stop `api-1`)

Stop the first node while traffic is flowing:

```bash
docker compose stop api-1
```

Wait ~10 seconds for Traefik's health check to detect that `api-1` is down. Repeat Step 1:

```bash
for i in $(seq 1 6); do curl -s localhost:8080/health/node; echo; done
```

**Observation:**
- Every single request returns `{"nodeId":"node-2",...}` with zero HTTP 502/503 errors.
- Any frontend client previously connected to `node-1` automatically reconnects to `node-2` within seconds and syncs recent messages.

### Step 4: Self-Healing & Cluster Recovery (Start `api-1`)

Restart `api-1`:

```bash
docker compose start api-1
```

Wait ~10 seconds for `api-1` to initialize and pass Traefik's `/health/ready` check. Repeat Step 1:

```bash
for i in $(seq 1 6); do curl -s localhost:8080/health/node; echo; done
```

**Observation:**
Traffic immediately resumes alternating between `node-1` and `node-2`.

---

## 8. Troubleshooting

### Cookies & Better Auth
- When running locally over plain `http://`, browser security policies drop cookies if marked `Secure`. Ensure `BETTER_AUTH_SECURE_COOKIES=false` is set in `apps/backend/.env`.
- Ensure `BETTER_AUTH_URL=http://localhost:8080` matches the Traefik load balancer port, so callback URLs align with client requests.

### CORS Errors
- If the frontend console shows CORS errors, verify `FRONTEND_URLS=http://localhost:5173` in `apps/backend/.env`. Both the HTTP middleware and Socket.IO gateway strictly validate against `FRONTEND_URLS` in production mode.

### Redis Connectivity & Readiness (HTTP 503)
- If `curl -i localhost:8080/health/ready` returns `503 Service Unavailable`, check `docker compose ps` to verify that `kyu-redis` is running and healthy. Inspect Redis logs via `docker compose logs redis`.

### Deployment to Render
- The backend remains 100% compatible with Render single-instance deployments. On Render, the service runs as a standalone process or container reading `PORT` from the environment without Traefik.
