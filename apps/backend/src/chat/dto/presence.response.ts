export interface UserPresence {
  online: boolean;
  lastSeenAt: string | null;
}

export interface PresenceResponse {
  presence: Record<string, UserPresence>;
}
