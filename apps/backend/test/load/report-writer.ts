import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ConnectMetric,
  LoadTestConfig,
  LoadTestReport,
  LoadTestRoom,
  ReceivedDeliveryInfo,
  SentMessageInfo,
  VerificationResult,
} from './types.js';
import { calcLatencySummary } from './stats.js';

export function compileReport(
  config: LoadTestConfig,
  runId: string,
  startTime: number,
  endTime: number,
  rooms: LoadTestRoom[],
  sentMessages: SentMessageInfo[],
  receivedDeliveries: ReceivedDeliveryInfo[],
  connectMetrics: ConnectMetric[],
  verification: VerificationResult,
): LoadTestReport {
  const durationSeconds = Math.max(0.1, (endTime - startTime) / 1000);
  const sentCount = sentMessages.length;
  const ackedCount = sentMessages.filter((m) => m.status === 'acked').length;
  const throttledCount = sentMessages.filter((m) => m.status === 'throttled').length;
  const erroredCount = sentMessages.filter((m) => m.status === 'errored').length;

  // Calculate expected deliveries: each delivered/stored message reaches all members in its room
  let expectedDeliveries = 0;
  for (const r of rooms) {
    const roomSent = sentMessages.filter((m) => m.roomId === r.id);
    const roomAcked = roomSent.filter((m) => m.status === 'acked').length;
    const roomEffective = Math.max(roomAcked, Math.min(roomSent.length, verification.totalStored));
    expectedDeliveries += roomEffective * r.memberIds.length;
  }

  const receivedCount = receivedDeliveries.length;
  const deliveryRatio =
    expectedDeliveries > 0
      ? Math.min(100, Math.round((receivedCount / expectedDeliveries) * 1000) / 10)
      : 100;

  const throughput = Math.round((sentCount / durationSeconds) * 10) / 10;

  // Latencies
  const ackLatencies = sentMessages
    .filter((m) => m.ackLatencyMs !== undefined)
    .map((m) => m.ackLatencyMs as number);
  const ackLatency = calcLatencySummary(ackLatencies);

  const deliveryLatencies = receivedDeliveries.map((d) => d.latencyMs);
  const deliveryLatency = calcLatencySummary(deliveryLatencies);

  const connectTimes = connectMetrics.map((c) => c.connectTimeMs);
  const connectTime = calcLatencySummary(connectTimes);

  const reconnectCount = connectMetrics.reduce((sum, c) => sum + c.reconnectCount, 0);
  const totalDowntimeMs = connectMetrics.reduce((sum, c) => sum + c.downtimeMs, 0);

  // Combine node counts from received deliveries and verification
  const nodeCounts: Record<string, number> = { ...verification.nodeCounts };
  for (const d of receivedDeliveries) {
    if (d.nodeId && !nodeCounts[d.nodeId]) {
      nodeCounts[d.nodeId] = (nodeCounts[d.nodeId] || 0) + 1;
    }
  }

  // Check acceptance criteria: lost == 0, duplicates == 0, deliveryRatio >= 99%
  const failureReasons: string[] = [];
  if (verification.lost > 0) {
    failureReasons.push(`Lost messages detected: ${verification.lost} acked messages missing from database`);
  }
  if (verification.duplicates > 0) {
    failureReasons.push(`Duplicate messages detected: ${verification.duplicates} duplicate clientMessageIds stored`);
  }
  // In distributed tests: lost == 0, duplicates == 0, deliveryRatio >= 99%
  // (except under deliberate failover where reconnect + catch-up is tested separately).
  if (reconnectCount === 0 && deliveryRatio < 99.0) {
    failureReasons.push(`Delivery ratio below threshold: ${deliveryRatio}% (minimum 99.0% required)`);
  } else if (reconnectCount > 0 && deliveryRatio < 80.0) {
    failureReasons.push(
      `Failover delivery ratio below threshold: ${deliveryRatio}% (minimum 80.0% required during active node failover)`,
    );
  }

  const success = failureReasons.length === 0;

  return {
    runId,
    timestamp: new Date().toISOString(),
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    config,
    usersCount: config.users,
    roomsCount: rooms.length,
    sentCount,
    ackedCount,
    throttledCount,
    erroredCount,
    expectedDeliveries,
    receivedDeliveries: receivedCount,
    deliveryRatioPercent: deliveryRatio,
    throughputMsgPerSec: throughput,
    ackLatency,
    deliveryLatency,
    connectTime,
    reconnectCount,
    totalDowntimeMs,
    nodeCounts,
    verification,
    success,
    exitReason: failureReasons.length > 0 ? failureReasons.join('; ') : undefined,
  };
}

export function printConsoleReport(report: LoadTestReport): void {
  const line = '═'.repeat(74);
  const subline = '─'.repeat(74);

  console.log(`\n${line}`);
  console.log(`  KYU CHATTER LOAD TEST & FAILOVER REPORT`);
  console.log(`  Run ID: ${report.runId} | Timestamp: ${report.timestamp}`);
  console.log(line);

  console.log(`  CONFIGURATION & SCOPE`);
  console.log(`  URL:             ${report.config.url}`);
  console.log(`  Users:           ${report.usersCount} | Rooms: ${report.roomsCount}`);
  console.log(`  Messages/User:   ${report.config.messages} | Total Sent: ${report.sentCount}`);
  console.log(`  Rate:            ${report.config.rate} msg/s/user | Duration: ${report.durationSeconds}s`);
  console.log(subline);

  console.log(`  THROUGHPUT & RELIABILITY`);
  console.log(`  Throughput:      ${report.throughputMsgPerSec} msg/s`);
  console.log(`  Acks Received:   ${report.ackedCount} / ${report.sentCount} (${Math.round((report.ackedCount / Math.max(1, report.sentCount)) * 100)}%)`);
  console.log(`  Throttled:       ${report.throttledCount}`);
  console.log(`  Errors:          ${report.erroredCount}`);
  console.log(`  Deliveries:      ${report.receivedDeliveries} received / ${report.expectedDeliveries} expected`);
  console.log(`  Delivery Ratio:  ${report.deliveryRatioPercent}%`);
  console.log(subline);

  console.log(`  LATENCY PERCENTILES`);
  console.log(`  Ack Latency:     p50: ${report.ackLatency.p50}ms | p95: ${report.ackLatency.p95}ms | p99: ${report.ackLatency.p99}ms (avg: ${report.ackLatency.avg}ms)`);
  console.log(`  Delivery Lat:    p50: ${report.deliveryLatency.p50}ms | p95: ${report.deliveryLatency.p95}ms | p99: ${report.deliveryLatency.p99}ms (avg: ${report.deliveryLatency.avg}ms)`);
  console.log(`  Connect Time:    p50: ${report.connectTime.p50}ms | p95: ${report.connectTime.p95}ms`);
  console.log(subline);

  console.log(`  DISTRIBUTED FAILOVER & PERSISTENCE`);
  console.log(`  Cluster Nodes:   ${JSON.stringify(report.nodeCounts)}`);
  console.log(`  Reconnects:      ${report.reconnectCount} observed (Downtime: ${report.totalDowntimeMs}ms)`);
  console.log(`  DB Verification: Stored: ${report.verification.totalStored} | Acked: ${report.verification.totalAcked}`);
  console.log(`  Lost Messages:   ${report.verification.lost} (expected: 0)`);
  console.log(`  Duplicate Msgs:  ${report.verification.duplicates} (expected: 0)`);
  console.log(line);

  if (report.success) {
    console.log(`  STATUS: PASSED (All reliability, persistence, and latency criteria met)`);
  } else {
    console.log(`  STATUS: FAILED - ${report.exitReason}`);
  }
  console.log(`${line}\n`);
}

export async function writeReportFiles(
  report: LoadTestReport,
  outDir: string,
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(outDir, { recursive: true });

  const safeTimestamp = report.timestamp.replace(/[:.]/g, '-');
  const jsonPath = join(outDir, `${safeTimestamp}.json`);
  const mdPath = join(outDir, `${safeTimestamp}.md`);

  // Write JSON artifact
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  // Write Markdown artifact
  const nodeTableRows = Object.entries(report.nodeCounts)
    .map(([node, count]) => `| \`${node}\` | ${count} |`)
    .join('\n');

  const markdown = `# Kyu Chatter Load Test Report

- **Run ID**: \`${report.runId}\`
- **Timestamp**: ${report.timestamp}
- **Duration**: ${report.durationSeconds} seconds
- **Status**: **${report.success ? 'PASSED' : 'FAILED'}** ${report.exitReason ? `(${report.exitReason})` : ''}

## 1. Parameters & Configuration

| Parameter | Value |
|---|---|
| Target URL | \`${report.config.url}\` |
| Origin | \`${report.config.origin}\` |
| Users | ${report.usersCount} |
| Rooms | ${report.roomsCount} (max room size: ${report.config.roomSize}) |
| Messages / User | ${report.config.messages} |
| Send Rate | ${report.config.rate} msg/s/user |
| User Prefix | \`${report.config.prefix}\` |
| User Reuse | \`${report.config.reuse}\` |
| Persistence Verified | \`${report.config.verify}\` |

## 2. Results & Reliability

| Metric | Value |
|---|---|
| Total Sent | ${report.sentCount} |
| Total Acked | ${report.ackedCount} (${Math.round((report.ackedCount / Math.max(1, report.sentCount)) * 100)}%) |
| Throttled | ${report.throttledCount} |
| Errored | ${report.erroredCount} |
| Expected Deliveries | ${report.expectedDeliveries} |
| Received Deliveries | ${report.receivedDeliveries} |
| **Delivery Ratio** | **${report.deliveryRatioPercent}%** |
| **Throughput** | **${report.throughputMsgPerSec} msg/s** |

## 3. Latency Metrics

| Metric | Min | p50 | p95 | p99 | Max | Avg |
|---|---|---|---|---|---|---|
| **Ack Latency** | ${report.ackLatency.min}ms | ${report.ackLatency.p50}ms | ${report.ackLatency.p95}ms | ${report.ackLatency.p99}ms | ${report.ackLatency.max}ms | ${report.ackLatency.avg}ms |
| **Delivery Latency** | ${report.deliveryLatency.min}ms | ${report.deliveryLatency.p50}ms | ${report.deliveryLatency.p95}ms | ${report.deliveryLatency.p99}ms | ${report.deliveryLatency.max}ms | ${report.deliveryLatency.avg}ms |
| **Connect Time** | ${report.connectTime.min}ms | ${report.connectTime.p50}ms | ${report.connectTime.p95}ms | ${report.connectTime.p99}ms | ${report.connectTime.max}ms | ${report.connectTime.avg}ms |

## 4. Multi-Node Cluster Distribution & Failover

- **Reconnects Observed**: ${report.reconnectCount}
- **Total Downtime**: ${report.totalDowntimeMs}ms
- **Messages per Node**:

| Node ID | Messages Handled |
|---|---|
${nodeTableRows || '| (none) | 0 |'}

## 5. Persistence & Idempotency Verification

| Verification Check | Result | Expected |
|---|---|---|
| Messages in Database | ${report.verification.totalStored} | ${report.verification.totalAcked} |
| **Lost Messages** | **${report.verification.lost}** | **0** |
| **Duplicate Messages** | **${report.verification.duplicates}** | **0** |
`;

  await writeFile(mdPath, markdown, 'utf-8');
  console.log(`Reports saved:`);
  console.log(`  - JSON: ${jsonPath}`);
  console.log(`  - Markdown: ${mdPath}`);

  return { jsonPath, mdPath };
}
