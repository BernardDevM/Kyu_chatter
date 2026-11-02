import { create } from "zustand";

import type { Message } from "../types/message";

interface ComposerState {
  /** message being replied to, per room */
  replyTo: Record<string, Message | undefined>;
  /** message being edited, per room */
  editing: Record<string, Message | undefined>;
  setReplyTo: (roomId: string, msg?: Message) => void;
  setEditing: (roomId: string, msg?: Message) => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  replyTo: {},
  editing: {},
  setReplyTo: (roomId, msg) =>
    set((s) => ({
      replyTo: { ...s.replyTo, [roomId]: msg },
      editing: { ...s.editing, [roomId]: undefined },
    })),
  setEditing: (roomId, msg) =>
    set((s) => ({
      editing: { ...s.editing, [roomId]: msg },
      replyTo: { ...s.replyTo, [roomId]: undefined },
    })),
}));
