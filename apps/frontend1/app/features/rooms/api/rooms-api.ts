import type { Page } from "@/features/messages/types/message";
import { apiClient } from "@/lib/api/client";

import type {
  Room,
  RoomDetail,
  RoomMember,
  RoomPreference,
} from "../types/room";

const defaultPreference: RoomPreference = {
  isMuted: false,
  isArchived: false,
  isPinned: false,
};

function normalizeRoom<T extends Room>(room: T): T {
  const rawPref =
    room.preference ??
    (room as unknown as { preferences?: Partial<RoomPreference> }).preferences ??
    defaultPreference;

  return {
    ...room,
    preference: {
      isMuted: rawPref?.isMuted ?? false,
      isArchived: rawPref?.isArchived ?? false,
      isPinned: rawPref?.isPinned ?? false,
    },
  };
}

export const roomsApi = {
  list: {
    call: async (params: { cursor?: string; limit?: number } = {}) => {
      const page = (await apiClient.get<Page<Room>>("/api/rooms", { params })).data;
      return {
        ...page,
        items: page.items.map(normalizeRoom),
      };
    },
  },
  get: {
    call: async (id: string) =>
      normalizeRoom((await apiClient.get<RoomDetail>(`/api/rooms/${id}`)).data),
  },
  createGroup: {
    call: async (body: {
      name: string;
      description?: string;
      memberUserIds: string[];
    }) =>
      normalizeRoom(
        (await apiClient.post<RoomDetail>("/api/rooms", body)).data,
      ),
  },
  direct: {
    call: async (targetUserId: string) =>
      normalizeRoom(
        (await apiClient.post<RoomDetail>("/api/rooms/direct", { targetUserId }))
          .data,
      ),
  },
  update: {
    call: async (
      id: string,
      patch: { name?: string; description?: string },
    ) =>
      normalizeRoom(
        (await apiClient.patch<RoomDetail>(`/api/rooms/${id}`, patch)).data,
      ),
  },
  remove: { call: (id: string) => apiClient.delete(`/api/rooms/${id}`) },
  addMembers: {
    call: async (id: string, userIds: string[]) =>
      (await apiClient.post<RoomMember[]>(`/api/rooms/${id}/members`, { userIds }))
        .data,
  },
  removeMember: {
    call: (id: string, userId: string) =>
      apiClient.delete(`/api/rooms/${id}/members/${userId}`),
  },
  leave: { call: (id: string) => apiClient.post(`/api/rooms/${id}/leave`, {}) },
  preferences: {
    call: async (id: string, patch: Partial<RoomPreference>) =>
      (
        await apiClient.patch<RoomPreference>(
          `/api/rooms/${id}/preferences`,
          patch,
        )
      ).data,
  },
  markRead: {
    call: (id: string, messageId: string) =>
      apiClient.post(`/api/rooms/${id}/read`, { messageId }),
  },
};
