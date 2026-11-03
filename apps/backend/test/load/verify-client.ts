import type {
  LoadTestConfig,
  LoadTestRoom,
  LoadTestUser,
  SentMessageInfo,
  VerificationResult,
} from './types.js';

interface MessageItem {
  id: string;
  roomId: string;
  clientMessageId: string;
  body: string | null;
  nodeId: string;
  createdAt: string;
}

interface MessagePageApiResponse {
  success: boolean;
  data: {
    items: MessageItem[];
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Paces asynchronous operations with a given sleep duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phase 5: Fetches message history via REST API and verifies database persistence.
 */
export async function verifyPersistence(
  config: LoadTestConfig,
  rooms: LoadTestRoom[],
  users: LoadTestUser[],
  sentMessages: SentMessageInfo[],
  runId: string,
): Promise<VerificationResult> {
  console.log(`Starting persistence verification via REST API for ${rooms.length} room(s)...`);

  const userMap = new Map<string, LoadTestUser>();
  for (const u of users) {
    userMap.set(u.id, u);
  }

  const storedMessages = new Map<string, MessageItem>();
  const duplicateIds = new Set<string>();
  const nodeCounts: Record<string, number> = {};

  const prefix = `LT|${runId}|`;

  for (const room of rooms) {
    const creator = userMap.get(room.creatorId) ?? users[0];
    let cursor: string | null = null;
    let page = 0;

    while (true) {
      page++;
      const query = new URLSearchParams();
      query.set('limit', '100');
      if (cursor) {
        query.set('cursor', cursor);
      }

      const url = `${config.url.replace(/\/+$/, '')}/api/rooms/${room.id}/messages?${query.toString()}`;

      let res: Response | null = null;
      let retries = 0;

      while (retries < 3) {
        retries++;
        try {
          res = await fetch(url, {
            headers: {
              Origin: config.origin,
              Cookie: creator.cookie,
            },
          });
          if (res.ok) break;
          await sleep(500);
        } catch {
          await sleep(500);
        }
      }

      if (!res || !res.ok) {
        console.warn(`  Failed to fetch messages for room ${room.id} (page ${page})`);
        break;
      }

      const json = (await res.json()) as MessagePageApiResponse;
      const items = json.data?.items ?? [];

      for (const item of items) {
        if (item.body && item.body.startsWith(prefix)) {
          if (storedMessages.has(item.clientMessageId)) {
            duplicateIds.add(item.clientMessageId);
          } else {
            storedMessages.set(item.clientMessageId, item);
          }

          if (item.nodeId) {
            nodeCounts[item.nodeId] = (nodeCounts[item.nodeId] || 0) + 1;
          }
        }
      }

      cursor = json.data?.nextCursor ?? null;
      if (!cursor || items.length === 0) {
        break;
      }
    }
  }

  const ackedSent = sentMessages.filter((m) => m.status === 'acked');
  let lostCount = 0;

  for (const acked of ackedSent) {
    if (!storedMessages.has(acked.clientMessageId)) {
      lostCount++;
    }
  }

  const result: VerificationResult = {
    totalStored: storedMessages.size,
    totalAcked: ackedSent.length,
    lost: lostCount,
    duplicates: duplicateIds.size,
    nodeCounts,
  };

  console.log(
    `Persistence verified: ${result.totalStored} stored messages, ${result.totalAcked} acked, lost: ${result.lost}, duplicates: ${result.duplicates}`,
  );
  console.log(`Node distribution across cluster:`, nodeCounts);

  return result;
}
