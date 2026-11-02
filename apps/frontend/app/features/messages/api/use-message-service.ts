import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import type { MediaItem } from "@/features/media/types/media";
import {
  emitQuiet,
  emitWithAck,
  getSocket,
  WS_CLIENT,
} from "@/features/realtime/lib/socket";
import { roomsApi } from "@/features/rooms/api/rooms-api";
import { useClearUnread } from "@/features/rooms/api/use-room-service";
import type { Room } from "@/features/rooms/types/room";
import { applyNewMessage } from "@/features/rooms/utils/rooms-cache";
import { handleError } from "@/lib/handle-error";
import { queryKeys } from "@/lib/query-keys";

import type { Message, SendMessageInput } from "../types/message";
import {
  type MessagesData,
  patchByClientId,
  patchMessage,
  setReactions,
  upsertMessage,
} from "../utils/messages-cache";
import { messagesApi } from "./messages-api";

const PAGE_SIZE = 30;

export function useMessagesQuery(roomId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(roomId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      messagesApi.list.call(roomId, {
        cursor: pageParam,
        limit: PAGE_SIZE,
        direction: "before",
      }),
    getNextPageParam: (last) =>
      last.hasMore ? (last.nextCursor ?? undefined) : undefined,
  });
}

export interface SendVariables extends SendMessageInput {
  /** shown in the optimistic bubble only */
  attachments?: MediaItem[];
  replyTo?: Message | null;
}

export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const key = queryKeys.messages(roomId);

  return useMutation({
    mutationFn: async (v: SendVariables) => {
      const payload: SendMessageInput = {
        clientMessageId: v.clientMessageId,
        body: v.body,
        replyToId: v.replyToId,
        mediaIds: v.mediaIds,
      };
      if (getSocket()?.connected) {
        try {
          return await emitWithAck<Message>(WS_CLIENT.MESSAGE_SEND, {
            roomId,
            ...payload,
          });
        } catch {
          // Fall back to REST; clientMessageId makes the retry idempotent.
        }
      }
      return messagesApi.send.call(roomId, payload);
    },
    onMutate: (v) => {
      if (!me) return;
      const optimistic: Message = {
        id: `pending-${v.clientMessageId}`,
        roomId,
        senderId: me.id,
        clientMessageId: v.clientMessageId,
        body: v.body ?? null,
        replyToId: v.replyToId ?? null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        sender: { id: me.id, name: me.name, image: me.image },
        attachments: v.attachments ?? [],
        reactions: [],
        pending: true,
      };
      queryClient.setQueryData<MessagesData>(key, (d) =>
        upsertMessage(d, optimistic),
      );
    },
    onSuccess: (msg) => {
      queryClient.setQueryData<MessagesData>(key, (d) => upsertMessage(d, msg));
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        applyNewMessage(rooms, msg, false),
      );
    },
    onError: (_e, v) => {
      queryClient.setQueryData<MessagesData>(key, (d) =>
        patchByClientId(d, v.clientMessageId, { pending: false, failed: true }),
      );
    },
  });
}

export function useEditMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: string }) =>
      messagesApi.edit.call(v.id, v.body),
    onSuccess: (msg) =>
      queryClient.setQueryData<MessagesData>(queryKeys.messages(roomId), (d) =>
        upsertMessage(d, msg),
      ),
    onError: (e) => handleError(e, "edit the message"),
  });
}

export function useDeleteMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.remove.call(id),
    onSuccess: (_d, id) =>
      queryClient.setQueryData<MessagesData>(queryKeys.messages(roomId), (d) =>
        patchMessage(d, id, { deletedAt: new Date().toISOString(), body: null }),
      ),
    onError: (e) => handleError(e, "delete the message"),
  });
}

export function useToggleReaction(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; emoji: string; hasReacted: boolean }) =>
      v.hasReacted
        ? messagesApi.unreact.call(v.id, v.emoji)
        : messagesApi.react.call(v.id, v.emoji),
    onSuccess: (reactions, v) =>
      queryClient.setQueryData<MessagesData>(queryKeys.messages(roomId), (d) =>
        setReactions(d, v.id, reactions),
      ),
    onError: (e) => handleError(e, "update the reaction"),
  });
}

/** Tell the server (and clear the badge) that a room is read up to `messageId`. */
export function useMarkRead() {
  const clearUnread = useClearUnread();
  return (roomId: string, messageId: string) => {
    clearUnread(roomId);
    if (getSocket()?.connected)
      emitQuiet(WS_CLIENT.MESSAGE_READ, { roomId, messageId });
    else void roomsApi.markRead.call(roomId, messageId);
  };
}
