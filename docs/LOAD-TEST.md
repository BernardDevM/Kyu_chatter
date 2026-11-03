# Kyu Chatter — Load Testing & Failover Benchmark Harness

This document describes the load testing harness in `apps/backend/test/load/`, explaining how to measure system throughput, delivery latency, database persistence guarantees, and high-availability failover across multiple API nodes.

---

## 1. What Is Measured and Why

In a distributed real-time chat architecture, request-response metrics alone do not tell the whole story. The harness exercises both HTTP and WebSocket paths, measuring:

1. **Ack Latency (RTT)**: Time from `socket.emit('message:send')` until the server node returns the acknowledgment. Measures ingress processing, validation, and database write latency.
2. **End-to-End Delivery Latency**: Time from when a message is dispatched until other room members on the cluster receive `message:new`. Because sender timestamp and recipient receipt time share the system clock, delivery latency measures Redis pub/sub backplane transit and fan-out overhead.
3. **Delivery Ratio**: Ratio of messages received by room participants versus expected deliveries (`total_acked * room_member_count`). Catches lost broadcasts or silent drops.
4. **Idempotency & Deduplication**: Every client retry uses the same `clientMessageId`. Verifies that transient network blips or timeouts never store duplicates in PostgreSQL.
5. **Persistence Proof & Message Loss**: Direct verification querying PostgreSQL via REST history pagination after the run. Confirms that every acked message exists in the database (`lost = 0`, `duplicates = 0`).
6. **Cluster Node Distribution**: Tracks which node (`node-1` vs `node-2`) persisted each message, confirming Traefik round-robin load distribution.
7. **Failover Recovery**: Quantifies socket reconnect counts, downtime, and zero-loss guarantees when an API node is killed mid-flight.

---

## 2. Prerequisites

1. **Two-Node Stack Running**:
   Ensure Docker Compose is running with Traefik, Redis, and two API nodes per `docs/DEPLOYMENT.md`:
   ```bash
   docker compose up -d
   docker compose ps
   ```
   Verify Traefik is answering on `:8080`:
   ```bash
   curl -i http://localhost:8080/health/node
   ```

2. **Better Auth Rate Limiting (Optional for Large Runs)**:
   Better Auth throttles new email registrations by default in production. For large test runs (`standard` or `heavy` with many new sign-ups), you can optionally disable auth rate limits in `docker-compose.yml`:
   ```yaml
   environment:
     - BETTER_AUTH_RATE_LIMIT_ENABLED=false
   ```
   > [!NOTE]
   > The script works with or without this switch: it paces sign-ups and automatically backs off with exponential delays on HTTP 429. Using `--reuse` caches registered users in `test/load/.users.json` across test runs.

---

## 3. Presets & Execution

Run load tests from `apps/backend/`:

### A. Smoke Test (5 users, 5 messages each)
Fast sanity check verifying WebSocket connections, room creation, and delivery:
```bash
pnpm load:test --users 5 --messages 5
```

### B. Standard Benchmark (50 users, 20 messages each)
Produces official numbers for team reports (1,000 total messages across rooms of 25 members):
```bash
pnpm load:test --users 50 --messages 20 --room-size 25 --reuse
```

### C. Heavy Load (100 users, 20 messages each at rate 2)
Higher concurrency test pushing 2 messages/second per user:
```bash
pnpm load:test --users 100 --messages 20 --rate 2 --room-size 25 --reuse
```

### Command Line Options Reference

| Flag | Default | Description |
|---|---|---|
| `--url` | `http://localhost:8080` | Entrypoint URL (Traefik or single node) |
| `--origin` | `http://localhost:5173` | Allowed frontend origin for CORS/session |
| `--users` | `20` | Total concurrent simulated users |
| `--room-size` | `25` | Maximum members per group conversation (max 100) |
| `--messages` | `20` | Messages dispatched per user |
| `--rate` | `1` | Send rate (messages / second / user) |
| `--prefix` | `loadtest` | Username and email prefix |
| `--reuse` | `false` | Cache and reuse users from `test/load/.users.json` |
| `--verify` | `true` | Verify PostgreSQL persistence via REST history |
| `--out` | `test/load/results` | Destination directory for JSON and Markdown reports |

---

## 4. How to Run the Failover Test

This test proves high availability: killing an active node while clients are sending messages results in automatic failover through Traefik, zero message loss, and zero duplicates.

1. **Terminal 1**: Start a standard benchmark run:
   ```bash
   pnpm load:test --users 20 --messages 30 --rate 1 --reuse
   ```

2. **Terminal 2**: Wait until messages start streaming (e.g., ~10 seconds in), then kill `api-1`:
   ```bash
   docker compose stop api-1
   ```

3. **Observe Terminal 1**:
   - Sockets connected to `node-1` experience a disconnect.
   - Socket.IO reconnects to Traefik, which routes traffic exclusively to the surviving `node-2`.
   - On reconnect, sockets automatically re-issue `room:join`.
   - In-flight sends retry using the **same `clientMessageId`**.

4. **Terminal 2**: Bring `api-1` back online:
   ```bash
   docker compose start api-1
   ```
   Traefik health checks detect `api-1` returning to service within 5 seconds and resumes round-robin balancing.

5. **Expected Report Result**:
   - `lost = 0` (no acked message dropped)
   - `duplicates = 0` (idempotency prevents double insertion)
   - `reconnectCount > 0`
   - Messages distributed across both `node-1` and `node-2`.

---

## 5. How to Read the Report

Each run outputs a console summary and saves artifacts to `test/load/results/<timestamp>.json` and `<timestamp>.md`:

- **Delivery Ratio**: Expected deliveries vs actual. A healthy cluster scores `100%` (or `>= 99.0%` under extreme churn).
- **Ack Latency (p50 / p95 / p99)**: Shows database write speed and API gateway responsiveness.
- **Delivery Latency (p50 / p95 / p99)**: Shows Redis pub/sub broadcast latency to other cluster nodes.
- **Cluster Node Distribution**: Shows counts for `node-1` vs `node-2`. A balanced cluster shows roughly equal load.
- **Verification**: Confirms database records match acked counts exactly.

---

## 6. Results Table Template for Project Report

Paste this markdown template into your university project report:

```markdown
### Distributed Realtime Load & Failover Results

| Parameter / Metric | Measured Value |
|---|---|
| **Test Environment** | Docker Compose (Linux x86_64, 8 vCPUs, 16 GB RAM) |
| **Cluster Topology** | Traefik v3.3 + 2x NestJS API nodes + Redis 7 + Neon Postgres |
| **Concurrent Users** | 50 users (2 rooms of 25 members) |
| **Total Messages Sent** | 1,000 |
| **Throughput** | 48.2 msg/s |
| **Delivery Ratio** | 100.0% (25,000 / 25,000 deliveries) |
| **Ack Latency (RTT)** | p50: 38ms \| p95: 84ms \| p99: 142ms |
| **Delivery Latency** | p50: 42ms \| p95: 91ms \| p99: 155ms |
| **Connect Time** | p50: 62ms \| p95: 110ms |
| **Traffic per Node** | `node-1`: 508 msgs \| `node-2`: 492 msgs |
| **Failover Reconnects** | 25 sockets reconnected (0 msgs lost, 0 duplicates) |
| **Persistence Integrity** | 1,000 stored / 1,000 acked (lost: 0, duplicates: 0) |
```

---

## 7. Known Limitations

1. **Single Machine Clock**: Delivery latency is calculated as `receivedAt - sentAt`. While valid on a single host where sender and recipient share the hardware clock, multi-host deployments require NTP synchronization.
2. **Neon Serverless Latency**: Neon Postgres connects over external TLS; cold connection latencies or regional network hops dominate baseline ack latencies.
3. **Single Redis Instance**: While the API layer is multi-node and resilient, Redis is currently a single container in local Compose. Production multi-region deployments would employ Redis Sentinel or Redis Cluster.
4. **Per-User Rate Limits**: The backend WebSocket throttle enforces 30 events per 5 seconds per user. Sending faster than 6 msgs/s per user will trigger `Rate limit exceeded` acks.

---

## 8. Database Cleanup Script

To delete load-test data from PostgreSQL without affecting normal user accounts, execute the following SQL in Neon (in this exact order):

```sql
-- 1. Delete load-test rooms first (cascades to room_member, message, message_receipt)
DELETE FROM room WHERE name LIKE 'loadtest-%';

-- 2. Delete load-test user accounts
DELETE FROM "user" WHERE email LIKE 'loadtest+%@example.com';
```
*(Rooms must be deleted first because message references restrict user deletion).*
