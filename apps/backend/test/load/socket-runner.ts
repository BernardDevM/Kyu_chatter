import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import type {
  ConnectMetric,
  LoadTestConfig,
  LoadTestRoom,
  LoadTestUser,
  ReceivedDeliveryInfo,
  SentMessageInfo,
} from './types.js';
import { parseMessageBody } from './stats.js';

interface WsAckNormalized {
  ok: boolean;
  roomId?: string;
  data?: unknown;
  code?: string;
  message?: string;
  error?: string;
}

/**
 * Normalizes an acknowledgment response whether returned raw or wrapped by an interceptor.
 */
function normalizeAck(ack: unknown): WsAckNormalized {
  if (!ack || typeof ack !== 'object') {
    return { ok: false, message: 'Empty or invalid ack response' };
  }

  const record = ack as Record<string, unknown>;

  // Check if wrapped in TransformResponseInterceptor envelope { success: true, data: { ok: true, ... } }
  if (record.success === true && record.data && typeof record.data === 'object') {
    const inner = record.data as Record<string, unknown>;
    if (typeof inner.ok === 'boolean') {
      return {
        ok: inner.ok,
        roomId: inner.roomId as string | undefined,
        data: inner.data,
        code: inner.code as string | undefined,
        message: (inner.message ?? inner.error) as string | undefined,
        error: (inner.error ?? inner.message) as string | undefined,
      };
    }
    return {
      ok: true,
      data: record.data,
      roomId: (record.data as Record<string, unknown>).roomId as string | undefined,
    };
  }

  // Direct shape { ok: boolean, ... }
  if (typeof record.ok === 'boolean') {
    return {
      ok: record.ok,
      roomId: record.roomId as string | undefined,
      data: record.data,
      code: record.code as string | undefined,
      message: (record.message ?? record.error) as string | undefined,
      error: (record.error ?? record.message) as string | undefined,
    };
  }

  return {
    ok: Boolean(record.ok || record.success),
    code: record.code as string | undefined,
    message: (record.message ?? record.error) as string | undefined,
  };
}

interface SocketClientContext {
  user: LoadTestUser;
  room: LoadTestRoom;
  socket: Socket;
  initialConnectDurationMs: number;
  connectedAt: number;
  disconnectedAt: number;
  reconnectCount: number;
  totalDowntimeMs: number;
}

/**
 * Paces asynchronous operations with a given sleep duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Emits an event with an acknowledgment and a timeout fallback.
 */
function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      timer = null;
      reject(new Error(`WebSocket ack timed out after ${timeoutMs}ms for event: ${event}`));
    }, timeoutMs);

    socket.emit(event, payload, (ack: T) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        resolve(ack);
      }
    });
  });
}

export class SocketRunner {
  private readonly contexts: SocketClientContext[] = [];
  private readonly sentMessages: SentMessageInfo[] = [];
  private readonly receivedDeliveries: ReceivedDeliveryInfo[] = [];
  private readonly seenDeliveries = new Set<string>();
  private isInterrupted = false;

  constructor(
    private readonly config: LoadTestConfig,
    private readonly users: LoadTestUser[],
    private readonly rooms: LoadTestRoom[],
    private readonly runId: string,
  ) {}

  /**
   * Graceful abort when SIGINT is caught.
   */
  interrupt(): void {
    this.isInterrupted = true;
    this.disconnectAll();
  }

  /**
   * Phase 2: Opens WebSocket connections and joins assigned rooms.
   */
  async connectAll(): Promise<ConnectMetric[]> {
    console.log(`Connecting ${this.users.length} WebSockets to ${this.config.url}...`);

    // Map each user to their room
    const userToRoom = new Map<number, LoadTestRoom>();
    for (const room of this.rooms) {
      for (const uIdx of room.userIndices) {
        userToRoom.set(uIdx, room);
      }
    }

    const connectPromises = this.users.map(async (user) => {
      // Small staggering delay to pace concurrent connection handshakes against Neon
      await sleep(user.index * 50);

      const room = userToRoom.get(user.index);
      if (!room) {
        throw new Error(`User index ${user.index} is not assigned to any room`);
      }

      const socket = io(this.config.url, {
        transports: ['websocket'],
        extraHeaders: {
          cookie: user.cookie,
          Origin: this.config.origin,
        },
        auth: user.token ? { token: user.token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
      });

      const ctx: SocketClientContext = {
        user,
        room,
        socket,
        initialConnectDurationMs: 0,
        connectedAt: 0,
        disconnectedAt: 0,
        reconnectCount: 0,
        totalDowntimeMs: 0,
      };
      this.contexts.push(ctx);

      // Listen for message broadcasts
      socket.on('message:new', (msg: {
        id: string;
        roomId: string;
        clientMessageId: string;
        body: string;
        nodeId: string;
        createdAt: string;
      }) => {
        const receivedAt = Date.now();
        const parsed = parseMessageBody(msg?.body);
        if (parsed && parsed.runId === this.runId) {
          const deliveryKey = `${msg.id}:${user.index}`;
          if (this.seenDeliveries.has(deliveryKey)) {
            return;
          }
          this.seenDeliveries.add(deliveryKey);

          const latencyMs = Math.max(0, receivedAt - parsed.sentAt);
          this.receivedDeliveries.push({
            messageId: msg.id,
            clientMessageId: msg.clientMessageId,
            roomId: msg.roomId,
            recipientUserIndex: user.index,
            senderUserIndex: parsed.userIndex,
            seq: parsed.seq,
            sentAt: parsed.sentAt,
            receivedAt,
            latencyMs,
            nodeId: msg.nodeId,
          });
        }
      });

      // Handle reconnect events during node failovers
      socket.on('disconnect', () => {
        ctx.disconnectedAt = Date.now();
      });

      socket.on('connect', () => {
        if (ctx.connectedAt > 0) {
          // Reconnection after a drop
          ctx.reconnectCount++;
          if (ctx.disconnectedAt > 0) {
            ctx.totalDowntimeMs += Date.now() - ctx.disconnectedAt;
            ctx.disconnectedAt = 0;
          }
          console.log(`\n  [User ${user.index}] Reconnected to cluster! Rejoining room ${room.name}...`);
          socket.emit('room:join', { roomId: room.id });
        }
      });

      // Wait for initial connection
      const connectStart = Date.now();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Socket connection timed out for user ${user.index}`));
        }, 10000);

        socket.once('connect', () => {
          clearTimeout(timer);
          ctx.connectedAt = Date.now();
          resolve();
        });

        socket.once('connect_error', (err) => {
          clearTimeout(timer);
          reject(new Error(`Socket connect_error for user ${user.index}: ${err.message}`));
        });
      });

      const connectDurationMs = Date.now() - connectStart;
      ctx.initialConnectDurationMs = connectDurationMs;

      // Join room with ack and retry on transient latency spikes
      let joined = false;
      let joinAttempts = 0;
      let lastJoinError = '';

      while (!joined && joinAttempts < 4 && !this.isInterrupted) {
        joinAttempts++;
        try {
          const rawJoinAck = await emitWithAck<unknown>(
            socket,
            'room:join',
            { roomId: room.id },
            12000,
          );
          const joinAck = normalizeAck(rawJoinAck);

          if (joinAck.ok) {
            joined = true;
          } else {
            lastJoinError = joinAck.message ?? joinAck.error ?? 'Join rejected';
            await sleep(600);
          }
        } catch (err: unknown) {
          lastJoinError = err instanceof Error ? err.message : String(err);
          await sleep(600);
        }
      }

      if (!joined) {
        throw new Error(
          `User ${user.index} failed to join room ${room.id}: ${lastJoinError}`,
        );
      }

      return {
        userIndex: user.index,
        connectTimeMs: connectDurationMs,
        reconnectCount: 0,
        downtimeMs: 0,
      };
    });

    const metrics = await Promise.all(connectPromises);
    console.log(`All ${metrics.length} sockets connected and joined rooms.`);
    return metrics;
  }

  /**
   * Phase 3: Sends messages from all users according to specified rate and counts.
   */
  async runSendPhase(): Promise<void> {
    const totalExpectedMessages = this.users.length * this.config.messages;
    const intervalMs = Math.max(1, Math.round(1000 / this.config.rate));

    console.log(
      `Starting send phase: ${this.users.length} users sending ${this.config.messages} messages each at ${this.config.rate} msg/s (interval: ${intervalMs}ms)...`,
    );

    let progressTimer: NodeJS.Timeout | null = setInterval(() => {
      const sent = this.sentMessages.length;
      const acked = this.sentMessages.filter((m) => m.status === 'acked').length;
      const throttled = this.sentMessages.filter((m) => m.status === 'throttled').length;
      const errored = this.sentMessages.filter((m) => m.status === 'errored').length;
      const rec = this.receivedDeliveries.length;
      const reconnects = this.contexts.reduce((acc, c) => acc + c.reconnectCount, 0);

      process.stdout.write(
        `\r  [Progress] Sent: ${sent}/${totalExpectedMessages} | Acked: ${acked} | Throttled: ${throttled} | Errored: ${errored} | Deliveries: ${rec} | Reconnects: ${reconnects}`,
      );
    }, 2000);

    const userTasks = this.contexts.map(async (ctx) => {
      const user = ctx.user;
      const room = ctx.room;

      for (let seq = 0; seq < this.config.messages; seq++) {
        if (this.isInterrupted) break;

        const clientMessageId = randomUUID();
        const sentAt = Date.now();
        const body = `LT|${this.runId}|${user.index}|${seq}|${sentAt}`;
        const payload = {
          roomId: room.id,
          clientMessageId,
          body,
        };

        const sentInfo: SentMessageInfo = {
          clientMessageId,
          roomId: room.id,
          userIndex: user.index,
          seq,
          body,
          sentAt,
          status: 'pending',
        };
        this.sentMessages.push(sentInfo);

        // Attempt send with retry on timeout/disconnect (exercises idempotency with same clientMessageId)
        let sentSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!sentSuccess && attempts < maxAttempts && !this.isInterrupted) {
          attempts++;
          try {
            const emitStart = Date.now();
            const rawAck = await emitWithAck<unknown>(
              ctx.socket,
              'message:send',
              payload,
              10000,
            );
            const ackDuration = Date.now() - emitStart;
            const ack = normalizeAck(rawAck);

            sentInfo.ackedAt = Date.now();
            sentInfo.ackLatencyMs = ackDuration;

            if (ack.ok) {
              sentInfo.status = 'acked';
              sentSuccess = true;
            } else {
              const errMsg = ack.message || ack.error || 'Unknown ack rejection';
              if (
                errMsg.includes('Rate limit exceeded') ||
                ack.code === 'THROTTLED' ||
                ack.code === 'RATE_LIMIT'
              ) {
                sentInfo.status = 'throttled';
                sentInfo.error = errMsg;
              } else {
                sentInfo.status = 'errored';
                sentInfo.error = errMsg;
              }
              sentSuccess = true; // Received definitive ack response
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (attempts >= maxAttempts) {
              sentInfo.status = 'errored';
              sentInfo.error = errMsg;
            } else {
              // Wait for socket to reconnect if dropped before retrying
              await sleep(600);
            }
          }
        }

        // Pace send rate per user
        await sleep(intervalMs);
      }
    });

    await Promise.all(userTasks);

    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    console.log();
    console.log('Send phase finished. Allowing 2.5s settle window for remaining deliveries...');
    await sleep(2500);
  }

  /**
   * Closes all active WebSocket connections cleanly.
   */
  disconnectAll(): void {
    for (const ctx of this.contexts) {
      try {
        ctx.socket.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }

  getSentMessages(): SentMessageInfo[] {
    return this.sentMessages;
  }

  getReceivedDeliveries(): ReceivedDeliveryInfo[] {
    return this.receivedDeliveries;
  }

  getConnectMetrics(): ConnectMetric[] {
    return this.contexts.map((ctx) => ({
      userIndex: ctx.user.index,
      connectTimeMs: ctx.initialConnectDurationMs,
      reconnectCount: ctx.reconnectCount,
      downtimeMs: ctx.totalDowntimeMs,
    }));
  }
}
