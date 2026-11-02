import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { handleError } from "@/lib/handle-error";
import { queryKeys } from "@/lib/query-keys";

import type { Room, RoomDetail, RoomPreference } from "../types/room";
import { clearUnread, upsertRoom } from "../utils/rooms-cache";
import { roomsApi } from "./rooms-api";

// First 100 rooms (API max page size). Realtime events keep the list fresh.
export function useRoomsQuery() {
  return useQuery({
    queryKey: queryKeys.rooms,
    queryFn: async () => (await roomsApi.list.call({ limit: 100 })).items,
  });
}

export function useRoomQuery(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.room(roomId ?? ""),
    queryFn: () => roomsApi.get.call(roomId!),
    enabled: enabled && !!roomId,
  });
}

function useRoomCache() {
  const queryClient = useQueryClient();
  return {
    save: (room: RoomDetail) => {
      queryClient.setQueryData(queryKeys.room(room.id), room);
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        upsertRoom(rooms, room),
      );
    },
    drop: (roomId: string) => {
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        rooms?.filter((r) => r.id !== roomId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.room(roomId) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(roomId) });
    },
    queryClient,
  };
}

export function useCreateGroup() {
  const cache = useRoomCache();
  return useMutation({
    mutationFn: roomsApi.createGroup.call,
    onSuccess: cache.save,
    onError: (e) => handleError(e, "create the group"),
  });
}

export function useOpenDirectRoom() {
  const cache = useRoomCache();
  return useMutation({
    mutationFn: roomsApi.direct.call,
    onSuccess: cache.save,
    onError: (e) => handleError(e, "open the chat"),
  });
}

export function useUpdateRoom(roomId: string) {
  const cache = useRoomCache();
  return useMutation({
    mutationFn: (patch: { name?: string; description?: string }) =>
      roomsApi.update.call(roomId, patch),
    onSuccess: cache.save,
    onError: (e) => handleError(e, "update the room"),
  });
}

export function useAddMembers(roomId: string) {
  const { queryClient } = useRoomCache();
  return useMutation({
    mutationFn: (userIds: string[]) => roomsApi.addMembers.call(roomId, userIds),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) }),
    onError: (e) => handleError(e, "add members"),
  });
}

export function useRemoveMember(roomId: string) {
  const { queryClient } = useRoomCache();
  return useMutation({
    mutationFn: (userId: string) => roomsApi.removeMember.call(roomId, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) }),
    onError: (e) => handleError(e, "remove the member"),
  });
}

export function useLeaveRoom() {
  const cache = useRoomCache();
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.leave.call(roomId),
    onSuccess: (_d, roomId) => cache.drop(roomId),
    onError: (e) => handleError(e, "leave the room"),
  });
}

export function useDeleteRoom() {
  const cache = useRoomCache();
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.remove.call(roomId),
    onSuccess: (_d, roomId) => cache.drop(roomId),
    onError: (e) => handleError(e, "delete the room"),
  });
}

export function useRoomPreferences(roomId: string) {
  const { queryClient } = useRoomCache();
  return useMutation({
    mutationFn: (patch: Partial<RoomPreference>) =>
      roomsApi.preferences.call(roomId, patch),
    onSuccess: (preference) =>
      queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
        rooms?.map((r) => (r.id === roomId ? { ...r, preference } : r)),
      ),
    onError: (e) => handleError(e, "update preferences"),
  });
}

export function useClearUnread() {
  const queryClient = useQueryClient();
  return (roomId: string) =>
    queryClient.setQueryData<Room[]>(queryKeys.rooms, (rooms) =>
      clearUnread(rooms, roomId),
    );
}
