/**
 * Internal presence snapshot produced by `PresenceService`.
 */
export interface UserPresence {
  online: boolean;
  lastSeenAt: string | null;
}

export interface PresenceSnapshot {
  presence: Record<string, UserPresence>;
}

/**
 * Presence status of one user as exposed by `GET /api/presence` (docs/API.md §5.1).
 * `lastSeenAt` is only present for OFFLINE users with a known last-seen time.
 */
export interface UserPresenceResponse {
  status: 'ONLINE' | 'OFFLINE';
  lastSeenAt?: string;
}

/**
 * Dictionary mapping user ID to presence status.
 */
export type PresenceResponse = Record<string, UserPresenceResponse>;

/**
 * Converts an internal presence snapshot to the public API shape.
 */
export function toPresenceResponse(snapshot: PresenceSnapshot): PresenceResponse {
  const result: PresenceResponse = {};
  for (const [id, p] of Object.entries(snapshot.presence)) {
    result[id] = p.online
      ? { status: 'ONLINE' }
      : {
          status: 'OFFLINE',
          ...(p.lastSeenAt ? { lastSeenAt: p.lastSeenAt } : {}),
        };
  }
  return result;
}
