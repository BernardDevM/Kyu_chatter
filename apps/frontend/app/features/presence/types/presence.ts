export interface Presence {
  online: boolean;
  lastSeenAt: string | null;
}

export interface PresenceResponse {
  [userId: string]: { status: "ONLINE" | "OFFLINE"; lastSeenAt?: string };
}
