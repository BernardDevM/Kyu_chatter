import { useParams } from "react-router";

import { RoomView } from "@/features/rooms/components/room-view";

export default function ChatRoomRoute() {
  const { roomId } = useParams();
  // key: remount per room so composer, scroll and typing state reset cleanly.
  return <RoomView key={roomId} roomId={roomId!} />;
}
