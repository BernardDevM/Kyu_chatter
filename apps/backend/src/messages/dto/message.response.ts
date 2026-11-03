import type { ReceiptStatus } from '../../generated/prisma/enums.js';
import type { UserSummaryResponse } from '../../users/dto/user.response.js';
import type { MediaResponse } from '../../media/dto/media.response.js';

/**
 * Aggregated reactions for one emoji (docs/API.md §6.6).
 * `hasReacted` is relative to the requesting user.
 */
export interface ReactionSummaryResponse {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userIds: string[];
}

export interface ReceiptResponse {
  messageId: string;
  userId: string;
  status: ReceiptStatus;
  updatedAt: string;
}

export interface MessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  clientMessageId: string;
  body: string | null;
  replyToId: string | null;
  nodeId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: UserSummaryResponse;
  attachments: MediaResponse[];
  reactions: ReactionSummaryResponse[];
}

export interface MessagePageResponse {
  items: MessageResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}
