import { useState } from "react";

import { LoadingScreen } from "@/components/states/loading-screen";
import { NotFound } from "@/components/states/not-found";
import { MessageComposer } from "@/features/messages/components/message-composer";
import { MessageList } from "@/features/messages/components/message-list";
import { TypingIndicator } from "@/features/messages/components/typing-indicator";

import { useRoomQuery } from "../api/use-room-service";
import { MembersPanel } from "./members-panel";
import { RoomHeader } from "./room-header";

export function RoomView({ roomId }: { roomId: string }) {
  const { data: room, isPending, isError } = useRoomQuery(roomId);
  const [showMembers, setShowMembers] = useState(true);

  if (isPending) return <LoadingScreen />;
  if (isError || !room) return <NotFound />;

  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <RoomHeader room={room} onToggleMembers={() => setShowMembers((s) => !s)} />
        <MessageList roomId={roomId} members={room.members ?? []} />
        <TypingIndicator roomId={roomId} members={room.members ?? []} />
        <MessageComposer roomId={roomId} />
      </section>
      {showMembers && (
        <div className="hidden lg:block">
          <MembersPanel room={room} />
        </div>
      )}
    </div>
  );
}
