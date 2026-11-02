import { NewChatDialog } from "@/features/rooms/components/new-chat-dialog";
import { ProfileDialog } from "@/features/users/components/profile-dialog";

// Global dialogs, mounted once in the signed-in area and opened through
// their zustand stores (useNewChatStore, useProfileDialogStore).
export function DrawerProvider() {
  return (
    <>
      <NewChatDialog />
      <ProfileDialog />
    </>
  );
}
