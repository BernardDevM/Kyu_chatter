import type { MemberRole, RoomType } from '../../generated/prisma/enums.js';
import type { UserSummaryResponse } from '../../users/dto/user.response.js';
import type { MessageResponse } from '../../messages/dto/message.response.js';

export interface RoomPreferenceResponse {
  isMuted: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

export interface RoomSummaryResponse {
  id: string;
  type: RoomType;
  name: string | null;
  description: string | null;
  image: string | null;
  lastMessage: MessageResponse | null;
  unreadCount: number;
  preferences: RoomPreferenceResponse;
  /** @deprecated Use `preferences`. */
  preference?: RoomPreferenceResponse;
  otherUser?: UserSummaryResponse;
  updatedAt: string;
}

export interface RoomPageResponse {
  items: RoomSummaryResponse[];
  nextCursor: string | null;
}

export interface RoomDetailResponse extends RoomSummaryResponse {
  directKey: string | null;
  createdById: string;
  createdAt: string;
  myRole: MemberRole;
  memberCount: number;
}

export interface RoomMemberResponse {
  user: UserSummaryResponse;
  role: MemberRole;
  joinedAt: string;
  isOnline: boolean;
}

export interface MarkReadResponse {
  roomId: string;
  lastReadMessageId: string;
  unreadCount: number;
}
