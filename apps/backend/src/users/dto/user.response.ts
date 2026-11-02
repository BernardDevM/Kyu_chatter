/**
 * Public summary of a user for messages, rooms, and search results.
 * Never exposes email or sensitive credentials.
 */
export interface UserSummaryResponse {
  id: string;
  name: string;
  image: string | null;
}

/**
 * Public profile of a user with online and activity indicators.
 */
export interface UserProfileResponse extends UserSummaryResponse {
  lastSeenAt: string | null;
  isOnline: boolean;
}

/**
 * Full private profile of the currently authenticated user.
 */
export interface MeResponse extends UserProfileResponse {
  email: string;
  emailVerified: boolean;
  createdAt: string;
}
