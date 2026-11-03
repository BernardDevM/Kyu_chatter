import { parseArgs } from 'node:util';
import type { LoadTestConfig, VerificationResult } from './types.js';
import { setupUsers } from './auth-client.js';
import { setupRooms } from './room-client.js';
import { SocketRunner } from './socket-runner.js';
import { verifyPersistence } from './verify-client.js';
import { compileReport, printConsoleReport, writeReportFiles } from './report-writer.js';

function parseConfig(): LoadTestConfig {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: 'http://localhost:8080' },
      origin: { type: 'string', default: 'http://localhost:5173' },
      users: { type: 'string', default: '20' },
      'room-size': { type: 'string', default: '25' },
      messages: { type: 'string', default: '20' },
      rate: { type: 'string', default: '1' },
      prefix: { type: 'string', default: 'loadtest' },
      reuse: { type: 'boolean', default: false },
      verify: { type: 'boolean', default: true },
      'no-verify': { type: 'boolean', default: false },
      out: { type: 'string', default: 'test/load/results' },
    },
    allowPositionals: true,
  });

  return {
    url: (values.url as string).replace(/\/+$/, ''),
    origin: (values.origin as string).replace(/\/+$/, ''),
    users: Math.max(1, parseInt(values.users as string, 10) || 20),
    roomSize: Math.max(1, Math.min(100, parseInt(values['room-size'] as string, 10) || 25)),
    messages: Math.max(1, parseInt(values.messages as string, 10) || 20),
    rate: Math.max(0.1, parseFloat(values.rate as string) || 1),
    prefix: values.prefix as string || 'loadtest',
    reuse: Boolean(values.reuse),
    verify: values['no-verify'] ? false : Boolean(values.verify),
    out: values.out as string || 'test/load/results',
  };
}

async function main(): Promise<void> {
  const config = parseConfig();
  const runId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();

  console.log(`\nStarting Kyu Chatter Distributed Load Test`);
  console.log(`Run ID:   ${runId}`);
  console.log(`Target:   ${config.url}`);
  console.log(`Scale:    ${config.users} users, ${config.messages} msg/user at ${config.rate} msg/s (room-size: ${config.roomSize})`);
  console.log(`Options:  reuse=${config.reuse}, verify=${config.verify}, out=${config.out}\n`);

  let runner: SocketRunner | null = null;
  let isInterrupted = false;

  const onInterrupt = async () => {
    if (isInterrupted) return;
    isInterrupted = true;
    console.log('\nReceived interrupt signal (Ctrl+C). Generating partial report...');
    if (runner) {
      runner.interrupt();
    }
  };

  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);

  try {
    // Phase 1: Setup users and rooms
    const users = await setupUsers(config, runId);
    if (isInterrupted) return;

    const rooms = await setupRooms(config, users, runId);
    if (isInterrupted) return;

    // Phase 2: Open sockets and subscribe to rooms
    runner = new SocketRunner(config, users, rooms, runId);
    await runner.connectAll();
    if (isInterrupted) return;

    // Phase 3 & 4: Run send and collect phases
    await runner.runSendPhase();
    const sendEndTime = Date.now();

    // Cleanly disconnect sockets
    runner.disconnectAll();

    // Phase 5: Verification of database persistence
    let verification: VerificationResult = {
      totalStored: 0,
      totalAcked: runner.getSentMessages().filter((m) => m.status === 'acked').length,
      lost: 0,
      duplicates: 0,
      nodeCounts: {},
    };

    if (config.verify && !isInterrupted) {
      verification = await verifyPersistence(
        config,
        rooms,
        users,
        runner.getSentMessages(),
        runId,
      );
    }

    // Phase 6: Compile and write reports
    const report = compileReport(
      config,
      runId,
      startTime,
      sendEndTime,
      rooms,
      runner.getSentMessages(),
      runner.getReceivedDeliveries(),
      runner.getConnectMetrics(),
      verification,
    );

    printConsoleReport(report);
    await writeReportFiles(report, config.out);

    if (!report.success) {
      process.exitCode = 1;
    }
  } catch (err: unknown) {
    console.error('\nFatal error during load test execution:', err);
    if (runner) {
      runner.disconnectAll();
    }
    process.exit(1);
  }
}

void main();
