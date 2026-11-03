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
 * Public profile of a user (`GET /api/users/:id`, docs/API.md §4.4).
 * Live online status is served by `/api/presence`, not here.
 */
export interface UserProfileResponse extends UserSummaryResponse {
  createdAt: string;
}

/**
 * Full private profile of the authenticated user (`/api/users/me`, docs/API.md §4.1).
 */
export interface MeResponse extends UserProfileResponse {
  email: string;
}
