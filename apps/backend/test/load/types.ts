export interface LoadTestConfig {
  url: string;
  origin: string;
  users: number;
  roomSize: number;
  messages: number;
  rate: number;
  prefix: string;
  reuse: boolean;
  verify: boolean;
  out: string;
}

export interface LoadTestUser {
  index: number;
  id: string;
  email: string;
  name: string;
  password: string;
  cookie: string;
  token?: string;
}

export interface LoadTestRoom {
  index: number;
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  userIndices: number[];
}

export interface SentMessageInfo {
  clientMessageId: string;
  roomId: string;
  userIndex: number;
  seq: number;
  body: string;
  sentAt: number;
  ackedAt?: number;
  ackLatencyMs?: number;
  status: 'acked' | 'throttled' | 'errored' | 'pending';
  error?: string;
}

export interface ReceivedDeliveryInfo {
  messageId: string;
  clientMessageId: string;
  roomId: string;
  recipientUserIndex: number;
  senderUserIndex: number;
  seq: number;
  sentAt: number;
  receivedAt: number;
  latencyMs: number;
  nodeId: string;
}

export interface ConnectMetric {
  userIndex: number;
  connectTimeMs: number;
  reconnectCount: number;
  downtimeMs: number;
}

export interface LatencyPercentiles {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
}

export interface VerificationResult {
  totalStored: number;
  totalAcked: number;
  lost: number;
  duplicates: number;
  nodeCounts: Record<string, number>;
}

export interface LoadTestReport {
  runId: string;
  timestamp: string;
  durationSeconds: number;
  config: LoadTestConfig;
  usersCount: number;
  roomsCount: number;
  sentCount: number;
  ackedCount: number;
  throttledCount: number;
  erroredCount: number;
  expectedDeliveries: number;
  receivedDeliveries: number;
  deliveryRatioPercent: number;
  throughputMsgPerSec: number;
  ackLatency: LatencyPercentiles;
  deliveryLatency: LatencyPercentiles;
  connectTime: {
    min: number;
    p50: number;
    p95: number;
    max: number;
    avg: number;
  };
  reconnectCount: number;
  totalDowntimeMs: number;
  nodeCounts: Record<string, number>;
  verification: VerificationResult;
  success: boolean;
  exitReason?: string;
}
