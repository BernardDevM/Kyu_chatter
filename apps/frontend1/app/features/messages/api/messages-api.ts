import { apiClient } from "@/lib/api/client";

import type {
  Message,
  Page,
  ReactionSummary,
  SendMessageInput,
} from "../types/message";

export const messagesApi = {
  list: {
    call: async (
      roomId: string,
      params: {
        cursor?: string;
        limit?: number;
        direction?: "before" | "after";
      } = {},
    ) =>
      (
        await apiClient.get<Page<Message>>(`/api/rooms/${roomId}/messages`, {
          params,
        })
      ).data,
  },
  sync: {
    call: async (roomId: string, afterId: string, limit = 100) =>
      (
        await apiClient.get<Page<Message>>(
          `/api/rooms/${roomId}/messages/sync`,
          { params: { afterId, limit } },
        )
      ).data,
  },
  send: {
    call: async (roomId: string, body: SendMessageInput) =>
      (await apiClient.post<Message>(`/api/rooms/${roomId}/messages`, body))
        .data,
  },
  edit: {
    call: async (id: string, body: string) =>
      (await apiClient.patch<Message>(`/api/messages/${id}`, { body })).data,
  },
  remove: { call: (id: string) => apiClient.delete(`/api/messages/${id}`) },
  react: {
    call: async (id: string, emoji: string) =>
      (
        await apiClient.post<ReactionSummary[]>(
          `/api/messages/${id}/reactions`,
          { emoji },
        )
      ).data,
  },
  unreact: {
    call: async (id: string, emoji: string) =>
      (
        await apiClient.delete<ReactionSummary[]>(
          `/api/messages/${id}/reactions`,
          { params: { emoji } },
        )
      ).data,
  },
};
