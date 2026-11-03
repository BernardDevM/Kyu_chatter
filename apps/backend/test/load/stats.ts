import type { LatencyPercentiles } from './types.js';

/**
 * Calculates a given percentile (0 - 100) from a series of numeric values.
 */
export function calcPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return Math.round(values[0]);

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return Math.round(sorted[lower]);
  }

  const interpolated = sorted[lower] * (1 - weight) + sorted[upper] * weight;
  return Math.round(interpolated);
}

/**
 * Computes min, max, avg, and p50, p95, p99 percentiles.
 */
export function calcLatencySummary(latencies: number[]): LatencyPercentiles {
  if (latencies.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const min = Math.round(sorted[0]);
  const max = Math.round(sorted[sorted.length - 1]);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / sorted.length) * 10) / 10;

  return {
    min,
    p50: calcPercentile(sorted, 50),
    p95: calcPercentile(sorted, 95),
    p99: calcPercentile(sorted, 99),
    max,
    avg,
  };
}

/**
 * Parses the load-test message body format:
 * `LT|<runId>|<userIndex>|<seq>|<sentAt>`
 */
export function parseMessageBody(
  body: string | null | undefined,
): { runId: string; userIndex: number; seq: number; sentAt: number } | null {
  if (!body || typeof body !== 'string' || !body.startsWith('LT|')) {
    return null;
  }

  const parts = body.split('|');
  if (parts.length < 5) return null;

  const runId = parts[1];
  const userIndex = parseInt(parts[2], 10);
  const seq = parseInt(parts[3], 10);
  const sentAt = parseInt(parts[4], 10);

  if (isNaN(userIndex) || isNaN(seq) || isNaN(sentAt)) {
    return null;
  }

  return { runId, userIndex, seq, sentAt };
}
