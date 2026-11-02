import { MessagesSquare } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { useNewChatStore } from "@/features/rooms/stores/new-chat-store";

export default function ChatIndex() {
  const onOpen = useNewChatStore((s) => s.onOpen);
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={MessagesSquare}
        title="Pick a conversation"
        description="Choose a chat from the list or start a new one."
        action={<Button onClick={() => onOpen()}>New chat</Button>}
      />
    </div>
  );
}
