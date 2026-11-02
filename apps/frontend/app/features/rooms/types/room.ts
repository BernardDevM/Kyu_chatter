import type { UserSummary } from "@/features/users/types/user";

export type RoomType = "GROUP" | "DIRECT";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

export interface RoomPreference {
  isMuted: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

export interface Room {
  id: string;
  type: RoomType;
  name: string | null;
  description: string | null;
  image: string | null;
  memberCount: number;
  lastMessage: {
    id: string;
    senderId: string;
    body: string | null;
    createdAt: string;
  } | null;
  unreadCount: number;
  preference: RoomPreference;
  preferences?: RoomPreference;
  updatedAt: string;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: UserSummary;
}

export interface RoomDetail extends Room {
  members?: RoomMember[];
}
