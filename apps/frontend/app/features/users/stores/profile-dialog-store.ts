import { create } from "zustand";

interface ProfileDialogState {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useProfileDialogStore = create<ProfileDialogState>((set) => ({
  open: false,
  onOpen: () => set({ open: true }),
  onClose: () => set({ open: false }),
}));
