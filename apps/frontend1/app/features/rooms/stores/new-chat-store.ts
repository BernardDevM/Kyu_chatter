import { create } from "zustand";

type Mode = "direct" | "group";

interface NewChatState {
  open: boolean;
  mode: Mode;
  onOpen: (mode?: Mode) => void;
  onClose: () => void;
  setMode: (mode: Mode) => void;
}

export const useNewChatStore = create<NewChatState>((set) => ({
  open: false,
  mode: "direct",
  onOpen: (mode = "direct") => set({ open: true, mode }),
  onClose: () => set({ open: false }),
  setMode: (mode) => set({ mode }),
}));
