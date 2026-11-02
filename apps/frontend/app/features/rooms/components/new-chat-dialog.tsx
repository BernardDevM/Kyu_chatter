import { useNavigate } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useOpenDirectRoom } from "../api/use-room-service";
import { useNewChatStore } from "../stores/new-chat-store";
import { CreateGroupForm } from "./create-group-form";
import { UserPicker } from "./user-picker";

export function NewChatDialog() {
  const { open, mode, onClose, setMode } = useNewChatStore();
  const navigate = useNavigate();
  const openDirect = useOpenDirectRoom();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Message one person or create a group.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct message</TabsTrigger>
            <TabsTrigger value="group">New group</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "direct" ? (
          <UserPicker
            onPick={(u) =>
              openDirect.mutate(u.id, {
                onSuccess: (room) => {
                  onClose();
                  navigate(`/chat/${room.id}`);
                },
              })
            }
          />
        ) : (
          <CreateGroupForm />
        )}
      </DialogContent>
    </Dialog>
  );
}
