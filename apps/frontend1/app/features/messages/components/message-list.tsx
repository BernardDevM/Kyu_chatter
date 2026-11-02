import { format } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";
import { Fragment, useLayoutEffect, useMemo, useRef } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import type { RoomMember } from "@/features/rooms/types/room";

import {
  useDeleteMessage,
  useMarkRead,
  useMessagesQuery,
  useSendMessage,
  useToggleReaction,
} from "../api/use-message-service";
import { toRows } from "../utils/group-messages";
import { flattenMessages } from "../utils/messages-cache";
import { MessageItem } from "./message-item";

const NEAR_BOTTOM_PX = 120;

export function MessageList({
  roomId,
  members,
}: {
  roomId: string;
  members: RoomMember[];
}) {
  const me = useCurrentUser();
  const query = useMessagesQuery(roomId);
  const toggleReaction = useToggleReaction(roomId);
  const deleteMessage = useDeleteMessage(roomId);
  const send = useSendMessage(roomId);
  const markRead = useMarkRead();

  const messages = useMemo(() => flattenMessages(query.data), [query.data]);
  const rows = useMemo(() => toRows(messages), [messages]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const iAmAdmin = members.some(
    (m) => m.userId === me?.id && (m.role === "OWNER" || m.role === "ADMIN"),
  );

  const scroller = useRef<HTMLDivElement>(null);
  const prev = useRef({ roomId: "", count: 0, firstId: "", height: 0 });

  // Stay pinned to the bottom for new messages, keep position when older
  // pages are prepended, and jump to the bottom when a room opens.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || messages.length === 0) return;
    const p = prev.current;
    const firstId = messages[0]!.id;
    const lastIsMine = messages.at(-1)!.senderId === me?.id;

    if (p.roomId !== roomId) {
      el.scrollTop = el.scrollHeight;
    } else if (firstId !== p.firstId && messages.length > p.count) {
      el.scrollTop += el.scrollHeight - p.height; // older page prepended
    } else if (messages.length > p.count) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      if (nearBottom || lastIsMine) el.scrollTop = el.scrollHeight;
    }
    prev.current = { roomId, count: messages.length, firstId, height: el.scrollHeight };
  }, [messages, roomId, me?.id]);

  // Opening the room, or a message arriving while it is open, marks it read.
  const lastId = messages.filter((m) => !m.pending && !m.failed).at(-1)?.id;
  useLayoutEffect(() => {
    if (lastId) markRead(roomId, lastId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, lastId]);

  if (query.isPending)
    return (
      <div className="flex-1 space-y-4 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto pt-2 pb-2">
      {query.hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load earlier messages
          </Button>
        </div>
      )}
      {messages.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="Say hello"
          description="No messages yet. Send the first one."
        />
      )}
      {rows.map(({ message, startsGroup, startsDay }) => (
        <Fragment key={message.id}>
          {startsDay && (
            <div className="my-3 flex items-center gap-3 px-4">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs font-medium">
                {format(new Date(message.createdAt), "EEEE, MMM d")}
              </span>
              <div className="bg-border h-px flex-1" />
            </div>
          )}
          <MessageItem
            message={message}
            startsGroup={startsGroup || startsDay}
            repliedTo={message.replyToId ? byId.get(message.replyToId) : undefined}
            isMine={message.senderId === me?.id}
            canDelete={message.senderId === me?.id || iAmAdmin}
            onReact={(emoji, hasReacted) =>
              toggleReaction.mutate({ id: message.id, emoji, hasReacted })
            }
            onDelete={() => deleteMessage.mutate(message.id)}
            onRetry={() =>
              send.mutate({
                clientMessageId: message.clientMessageId,
                body: message.body ?? undefined,
                replyToId: message.replyToId ?? undefined,
                mediaIds: message.attachments.map((a) => a.id),
                attachments: message.attachments,
              })
            }
          />
        </Fragment>
      ))}
    </div>
  );
}
