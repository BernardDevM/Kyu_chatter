import type { MediaItem } from "@/features/media/types/media";
import type { UserSummary } from "@/features/users/types/user";

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userIds: string[];
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  clientMessageId: string;
  body: string | null;
  replyToId: string | null;
  nodeId?: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: UserSummary;
  attachments: MediaItem[];
  reactions: ReactionSummary[];
  /** client only: optimistic send in flight */
  pending?: boolean;
  /** client only: send failed */
  failed?: boolean;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SendMessageInput {
  clientMessageId: string;
  body?: string;
  replyToId?: string;
  mediaIds?: string[];
}
