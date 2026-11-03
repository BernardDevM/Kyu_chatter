import { describe, it, expect } from 'vitest';
import { calcPercentile, calcLatencySummary, parseMessageBody } from './stats.js';
import { compileReport } from './report-writer.js';
import type { LoadTestConfig, LoadTestRoom } from './types.js';

describe('Load Test Statistics & Parsing', () => {
  describe('calcPercentile', () => {
    it('handles empty and single-element arrays', () => {
      expect(calcPercentile([], 50)).toBe(0);
      expect(calcPercentile([42], 50)).toBe(42);
      expect(calcPercentile([42], 99)).toBe(42);
    });

    it('calculates exact and interpolated percentiles', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(calcPercentile(data, 50)).toBe(55);
      expect(calcPercentile(data, 90)).toBe(91);
      expect(calcPercentile(data, 100)).toBe(100);
      expect(calcPercentile(data, 0)).toBe(10);
    });
  });

  describe('calcLatencySummary', () => {
    it('returns zeroes for empty inputs', () => {
      const summary = calcLatencySummary([]);
      expect(summary).toEqual({ min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 });
    });

    it('computes summary metrics correctly', () => {
      const latencies = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      const summary = calcLatencySummary(latencies);
      expect(summary.min).toBe(5);
      expect(summary.max).toBe(50);
      expect(summary.avg).toBe(27.5);
      expect(summary.p50).toBe(28);
    });
  });

  describe('parseMessageBody', () => {
    it('parses valid load-test message body', () => {
      const body = 'LT|run123|4|12|1730600000000';
      const parsed = parseMessageBody(body);
      expect(parsed).toEqual({
        runId: 'run123',
        userIndex: 4,
        seq: 12,
        sentAt: 1730600000000,
      });
    });

    it('returns null for invalid format or non-numeric tokens', () => {
      expect(parseMessageBody(null)).toBeNull();
      expect(parseMessageBody('')).toBeNull();
      expect(parseMessageBody('Hello world')).toBeNull();
      expect(parseMessageBody('LT|run123|notanumber|12|1730600000000')).toBeNull();
      expect(parseMessageBody('LT|run123')).toBeNull();
    });
  });

  describe('compileReport', () => {
    const config: LoadTestConfig = {
      url: 'http://localhost:8080',
      origin: 'http://localhost:5173',
      users: 2,
      roomSize: 10,
      messages: 2,
      rate: 1,
      prefix: 'test',
      reuse: false,
      verify: true,
      out: 'test/load/results',
    };

    const rooms: LoadTestRoom[] = [
      {
        index: 0,
        id: 'room-1',
        name: 'test-room-1',
        creatorId: 'usr-1',
        memberIds: ['usr-1', 'usr-2'],
        userIndices: [0, 1],
      },
    ];

    it('computes 100% delivery ratio when all expected deliveries are received', () => {
      const sentMessages = [
        {
          clientMessageId: 'msg-1',
          roomId: 'room-1',
          userIndex: 0,
          seq: 0,
          body: 'LT|r1|0|0|1000',
          sentAt: 1000,
          ackedAt: 1050,
          ackLatencyMs: 50,
          status: 'acked' as const,
        },
      ];

      const receivedDeliveries = [
        {
          messageId: 'm-1',
          clientMessageId: 'msg-1',
          roomId: 'room-1',
          recipientUserIndex: 0,
          senderUserIndex: 0,
          seq: 0,
          sentAt: 1000,
          receivedAt: 1060,
          latencyMs: 60,
          nodeId: 'node-1',
        },
        {
          messageId: 'm-1',
          clientMessageId: 'msg-1',
          roomId: 'room-1',
          recipientUserIndex: 1,
          senderUserIndex: 0,
          seq: 0,
          sentAt: 1000,
          receivedAt: 1065,
          latencyMs: 65,
          nodeId: 'node-2',
        },
      ];

      const verification = {
        totalStored: 1,
        totalAcked: 1,
        lost: 0,
        duplicates: 0,
        nodeCounts: { 'node-1': 1 },
      };

      const report = compileReport(
        config,
        'r1',
        1000,
        2000,
        rooms,
        sentMessages,
        receivedDeliveries,
        [{ userIndex: 0, connectTimeMs: 100, reconnectCount: 0, downtimeMs: 0 }],
        verification,
      );

      expect(report.success).toBe(true);
      expect(report.expectedDeliveries).toBe(2);
      expect(report.receivedDeliveries).toBe(2);
      expect(report.deliveryRatioPercent).toBe(100);
      expect(report.verification.lost).toBe(0);
      expect(report.verification.duplicates).toBe(0);
    });

    it('marks report as failed if lost messages exist', () => {
      const report = compileReport(
        config,
        'r1',
        1000,
        2000,
        rooms,
        [],
        [],
        [],
        {
          totalStored: 0,
          totalAcked: 2,
          lost: 2,
          duplicates: 0,
          nodeCounts: {},
        },
      );

      expect(report.success).toBe(false);
      expect(report.exitReason).toContain('Lost messages detected');
    });
  });
});
