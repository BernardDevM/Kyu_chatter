import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { messagesApi } from "@/features/messages/api/messages-api";
import type { Message, ReactionSummary } from "@/features/messages/types/message";
import {
  lastConfirmedId,
  type MessagesData,
  patchMessage,
  setReactions,
  upsertMessage,
} from "@/features/messages/utils/messages-cache";
import { usePresenceStore } from "@/features/presence/stores/presence-store";
import type { Room, RoomDetail } from "@/features/rooms/types/room";
import { applyNewMessage, upsertRoom } from "@/features/rooms/utils/rooms-cache";
import { queryKeys } from "@/lib/query-keys";

import {
  connectSocket,
  disconnectSocket,
  emitQuiet,
  WS_CLIENT,
  WS_SERVER,
} from "../lib/socket";
import { useConnectionStore } from "../stores/connection-store";
import { useTypingStore } from "../stores/typing-store";

const HEARTBEAT_MS = 30_000;

/**
 * Owns the socket for the signed-in user and folds every server event into
 * the React Query cache and the small realtime stores.
 */
export function useRealtimeEvents() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const { roomId: routeRoomId } = useParams();

  // Handlers are registered once; read the live active room through a ref.
  const activeRoomRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    activeRoomRef.current = routeRoomId;
  }, [routeRoomId]);

  const meId = me?.id;

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();
    const { setStatus } = useConnectionStore.getState();
    setStatus("connecting");

    const joinAll = () => {
      const rooms = queryClient.getQueryData<Room[]>(queryKeys.rooms);
      rooms?.forEach((r) => emitQuiet(WS_CLIENT.ROOM_JOIN, { roomId: r.id }));
    };

    // After a drop, fetch whatever each open thread missed.
    const resync = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
      for (const [key, data] of queryClient.getQueriesData<MessagesData>({
        queryKey: ["messages"],
      })) {
        const roomId = key[1] as string;
        const afterId = lastConfirmedId(data);
        if (!afterId) continue;
        messagesApi.sync
          .call(roomId, afterId)
          .then((page) =>
            queryClient.setQueryData<MessagesData>(
              queryKeys.messages(roomId),
              (d) => page.items.reduce((acc, m) => upsertMessage(acc, m), d),
            ),
          )
          .catch(() => queryClient.invalidateQueries({ queryKey: key }));
      }
    };

    let wasConnected = false;
    const onConnect = () => {
      setStatus("connected");
      joinAll();
      if (wasConnected) resync();
      wasConnected = true;
    };
    const onDisconnect = () => setStatus("disconnected");

    const onNew = (msg: Message) => {
      const mine = msg.senderId === meId;
      const active = activeRoomRef.current === msg.roomId;
      queryClient.setQueryData<MessagesData>(queryKeys.messages(msg.roomId), (d) =>
        upsertMessage(d, msg),
      );
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        applyNewMessage(rooms, msg, !mine && !active),
      );
      if (!mine) useTypingStore.getState().setTyping(msg.roomId, msg.senderId, false);
    };

    const onUpdated = (msg: Message) =>
      queryClient.setQueryData<MessagesData>(queryKeys.messages(msg.roomId), (d) =>
        upsertMessage(d, msg),
      );

    const onDeleted = (p: { messageId: string; roomId: string }) =>
      queryClient.setQueryData<MessagesData>(queryKeys.messages(p.roomId), (d) =>
        patchMessage(d, p.messageId, {
          deletedAt: new Date().toISOString(),
          body: null,
        }),
      );

    const onReaction = (p: { messageId: string; reactions: ReactionSummary[] }) => {
      // `hasReacted` is per viewer; recompute it from the id list.
      const reactions = p.reactions.map((r) => ({
        ...r,
        hasReacted: r.userIds.includes(meId),
      }));
      for (const [key] of queryClient.getQueriesData<MessagesData>({
        queryKey: ["messages"],
      }))
        queryClient.setQueryData<MessagesData>(key, (d) =>
          setReactions(d, p.messageId, reactions),
        );
    };

    const onTyping = (p: { roomId: string; userId: string; isTyping: boolean }) => {
      if (p.userId !== meId)
        useTypingStore.getState().setTyping(p.roomId, p.userId, p.isTyping);
    };

    const onPresence = (p: {
      userId: string;
      online: boolean;
      lastSeenAt: string | null;
    }) =>
      usePresenceStore
        .getState()
        .setPresence(p.userId, { online: p.online, lastSeenAt: p.lastSeenAt });

    const onRoomUpdated = (room: RoomDetail) => {
      queryClient.setQueryData(queryKeys.room(room.id), room);
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        upsertRoom(rooms, room),
      );
    };

    const onMembership = (p: { roomId: string; userId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(p.roomId) });
      if (p.userId === meId)
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
    };

    const onError = (e: { message?: string }) =>
      toast.error(e?.message ?? "Realtime error");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(WS_SERVER.MESSAGE_NEW, onNew);
    socket.on(WS_SERVER.MESSAGE_UPDATED, onUpdated);
    socket.on(WS_SERVER.MESSAGE_DELETED, onDeleted);
    socket.on(WS_SERVER.REACTION_UPDATED, onReaction);
    socket.on(WS_SERVER.TYPING, onTyping);
    socket.on(WS_SERVER.PRESENCE_UPDATE, onPresence);
    socket.on(WS_SERVER.ROOM_UPDATED, onRoomUpdated);
    socket.on(WS_SERVER.MEMBER_JOINED, onMembership);
    socket.on(WS_SERVER.MEMBER_LEFT, onMembership);
    socket.on(WS_SERVER.ERROR, onError);

    const heartbeat = setInterval(
      () => emitQuiet(WS_CLIENT.HEARTBEAT),
      HEARTBEAT_MS,
    );

    return () => {
      clearInterval(heartbeat);
      socket.removeAllListeners();
      disconnectSocket();
      setStatus("disconnected");
    };
  }, [meId, queryClient]);
}
