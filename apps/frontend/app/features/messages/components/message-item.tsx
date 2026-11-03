import { format } from "date-fns";
import { AlertCircle, CornerUpLeft, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/features/users/components/user-avatar";
import { cn } from "@/lib/utils";

import { useComposerStore } from "../stores/composer-store";
import type { Message } from "../types/message";
import { MessageAttachments } from "./message-attachments";
import { ReactionBar, ReactionPicker } from "./reaction-bar";

interface Props {
  message: Message;
  startsGroup: boolean;
  repliedTo?: Message;
  isMine: boolean;
  canDelete: boolean;
  onReact: (emoji: string, hasReacted: boolean) => void;
  onDelete: () => void;
  onRetry: () => void;
}

export function MessageItem({
  message: m,
  startsGroup,
  repliedTo,
  isMine,
  canDelete,
  onReact,
  onDelete,
  onRetry,
}: Props) {
  const { setReplyTo, setEditing } = useComposerStore();
  const deleted = !!m.deletedAt;
  const time = format(new Date(m.createdAt), "HH:mm");

  return (
    <div
      className={cn(
        "group hover:bg-muted/60 relative flex gap-3 px-4 py-0.5 md:px-6",
        startsGroup && "mt-3",
        m.pending && "opacity-60",
      )}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {startsGroup ? (
          <UserAvatar name={m.sender.name} image={m.sender.image} userId={m.senderId} />
        ) : (
          <span className="text-muted-foreground hidden font-mono text-[10px] group-hover:block">
            {time}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {startsGroup && (
          <div className="flex items-baseline gap-2">
            <span className={cn("font-display text-sm font-bold", isMine && "text-primary")}>
              {m.sender.name}
            </span>
            <span className="text-muted-foreground font-mono text-[10px]">{time}</span>
          </div>
        )}

        {m.replyToId && (
          <div className="border-primary/50 text-muted-foreground mb-1 flex items-center gap-1.5 border-l-2 pl-2 text-xs">
            <CornerUpLeft className="size-3" />
            <span className="truncate">
              {repliedTo
                ? `${repliedTo.sender.name}: ${repliedTo.deletedAt ? "Message deleted" : (repliedTo.body ?? "Attachment")}`
                : "Original message"}
            </span>
          </div>
        )}

        {deleted ? (
          <p className="text-muted-foreground text-sm italic">Message deleted</p>
        ) : (
          <>
            {m.body && (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {m.body}
                {m.editedAt && (
                  <span className="text-muted-foreground ml-1.5 text-[11px]">(edited)</span>
                )}
              </p>
            )}
            <MessageAttachments items={m.attachments} />
            <ReactionBar reactions={m.reactions} onToggle={onReact} />
          </>
        )}

        {m.failed && (
          <button
            type="button"
            onClick={onRetry}
            className="text-destructive mt-1 flex items-center gap-1 text-xs"
          >
            <AlertCircle className="size-3" /> Failed to send. Tap to retry
          </button>
        )}
        {m.pending && <Loader2 className="text-muted-foreground mt-1 size-3 animate-spin" />}
      </div>

      {!deleted && !m.pending && !m.failed && (
        <div className="bg-popover absolute -top-3 right-4 hidden md:right-6 items-center rounded-md border shadow-sm group-hover:flex">
          <ReactionPicker onPick={(e) => onReact(e, false)} />
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Reply"
            onClick={() => setReplyTo(m.roomId, m)}
          >
            <CornerUpLeft />
          </Button>
          {isMine && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Edit"
              onClick={() => setEditing(m.roomId, m)}
            >
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-7"
              aria-label="Delete"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
