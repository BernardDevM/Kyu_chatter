import { useState } from "react";

import { LoadingScreen } from "@/components/states/loading-screen";
import { NotFound } from "@/components/states/not-found";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MessageComposer } from "@/features/messages/components/message-composer";
import { MessageList } from "@/features/messages/components/message-list";
import { TypingIndicator } from "@/features/messages/components/typing-indicator";

import { useRoomQuery } from "../api/use-room-service";
import { MembersPanel } from "./members-panel";
import { RoomHeader } from "./room-header";

export function RoomView({ roomId }: { roomId: string }) {
  const { data: room, isPending, isError } = useRoomQuery(roomId);
  const [showInfo, setShowInfo] = useState(false);

  if (isPending) return <LoadingScreen />;
  if (isError || !room) return <NotFound />;

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <RoomHeader room={room} onShowMembers={() => setShowInfo(true)} />
      <MessageList roomId={roomId} members={room.members ?? []} />
      <TypingIndicator roomId={roomId} members={room.members ?? []} />
      <MessageComposer roomId={roomId} />

      <Sheet open={showInfo} onOpenChange={setShowInfo}>
        <SheetContent className="w-80 gap-0 p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Room info</SheetTitle>
          <SheetDescription className="sr-only">Members and details</SheetDescription>
          <MembersPanel room={room} />
        </SheetContent>
      </Sheet>
    </section>
  );
}
