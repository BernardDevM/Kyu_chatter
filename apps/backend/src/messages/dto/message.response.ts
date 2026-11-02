import type { ReceiptStatus } from '../../generated/prisma/enums.js';
import type { UserSummaryResponse } from '../../users/dto/user.response.js';
import type { AttachmentResponse } from '../../media/dto/media.response.js';

export interface ReactionSummaryResponse {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  hasReacted?: boolean;
  userIds?: string[];
}

export interface ReceiptResponse {
  userId: string;
  status: ReceiptStatus;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface ReplyToSummaryResponse {
  id: string;
  body: string | null;
  senderName: string;
}

export interface MessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  sender: UserSummaryResponse;
  clientMessageId: string;
  body: string | null;
  replyToId: string | null;
  replyTo: ReplyToSummaryResponse | null;
  attachments: AttachmentResponse[];
  reactions: ReactionSummaryResponse[];
  nodeId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface MessagePageResponse {
  items: MessageResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}
