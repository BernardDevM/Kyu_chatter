import { create } from "zustand";

const TYPING_TTL_MS = 5_000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

interface TypingState {
  /** roomId -> userIds currently typing */
  typing: Record<string, string[]>;
  setTyping: (roomId: string, userId: string, isTyping: boolean) => void;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typing: {},
  setTyping: (roomId, userId, isTyping) => {
    const key = `${roomId}:${userId}`;
    clearTimeout(timers.get(key));
    timers.delete(key);

    const without = (get().typing[roomId] ?? []).filter((id) => id !== userId);
    set((s) => ({
      typing: { ...s.typing, [roomId]: isTyping ? [...without, userId] : without },
    }));

    // A lost `typing:stop` must not leave the indicator stuck.
    if (isTyping)
      timers.set(
        key,
        setTimeout(() => get().setTyping(roomId, userId, false), TYPING_TTL_MS),
      );
  },
}));
