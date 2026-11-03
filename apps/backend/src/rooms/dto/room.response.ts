import type { MemberRole, RoomType } from '../../generated/prisma/enums.js';
import type { UserSummaryResponse } from '../../users/dto/user.response.js';

export interface RoomPreferenceResponse {
  isMuted: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

/**
 * Result of `PATCH /api/rooms/:roomId/preferences` (docs/API.md §6.12).
 */
export interface RoomPreferenceUpdateResponse extends RoomPreferenceResponse {
  roomId: string;
  userId: string;
}

/**
 * Compact preview of the newest message in a room.
 */
export interface RoomLastMessageResponse {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
}

export interface RoomSummaryResponse {
  id: string;
  type: RoomType;
  name: string | null;
  description: string | null;
  image: string | null;
  memberCount: number;
  lastMessage: RoomLastMessageResponse | null;
  unreadCount: number;
  preference: RoomPreferenceResponse;
  updatedAt: string;
}

export interface RoomPageResponse {
  items: RoomSummaryResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RoomMemberResponse {
  roomId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: UserSummaryResponse;
}

export interface RoomDetailResponse extends RoomSummaryResponse {
  members: RoomMemberResponse[];
}

export interface MarkReadResponse {
  roomId: string;
  userId: string;
  lastReadMessageId: string;
  readAt: string;
}
