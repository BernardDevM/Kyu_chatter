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
        "group relative flex items-end gap-2 px-4 md:px-8",
        isMine && "flex-row-reverse",
        startsGroup ? "mt-3" : "mt-0.5",
        m.pending && "opacity-60",
      )}
    >
      {/* avatar slot keeps grouped bubbles aligned */}
      <div className="w-8 shrink-0">
        {!isMine && startsGroup && (
          <UserAvatar name={m.sender.name} image={m.sender.image} userId={m.senderId} className="size-8" />
        )}
      </div>

      <div className={cn("flex max-w-[78%] flex-col md:max-w-[65%]", isMine ? "items-end" : "items-start")}>
        {!isMine && startsGroup && (
          <span className="text-muted-foreground mb-0.5 ml-3 text-xs font-medium">
            {m.sender.name}
          </span>
        )}

        <div
          className={cn(
            "relative rounded-3xl px-4 py-2 text-sm",
            isMine
              ? "bg-signal text-signal-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md",
            deleted && "bg-transparent text-muted-foreground border border-dashed italic",
          )}
        >
          {m.replyToId && !deleted && (
            <div
              className={cn(
                "mb-1.5 flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs",
                isMine ? "bg-signal-foreground/10" : "bg-background/70",
              )}
            >
              <CornerUpLeft className="size-3 shrink-0" />
              <span className="truncate">
                {repliedTo
                  ? `${repliedTo.sender.name}: ${repliedTo.deletedAt ? "Message deleted" : (repliedTo.body ?? "Attachment")}`
                  : "Original message"}
              </span>
            </div>
          )}

          {deleted ? (
            "Message deleted"
          ) : (
            <>
              {m.body && (
                <p className="leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>
              )}
              <MessageAttachments items={m.attachments} />
              <span
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px]",
                  isMine ? "text-signal-foreground/60" : "text-muted-foreground",
                )}
              >
                {m.editedAt && "edited ·"} {time}
                {m.pending && <Loader2 className="size-3 animate-spin" />}
              </span>
            </>
          )}
        </div>

        {!deleted && (
          <ReactionBar reactions={m.reactions} onToggle={onReact} />
        )}

        {m.failed && (
          <button
            type="button"
            onClick={onRetry}
            className="text-destructive mt-1 flex items-center gap-1 text-xs"
          >
            <AlertCircle className="size-3" /> Not sent. Tap to retry
          </button>
        )}
      </div>

      {!deleted && !m.pending && !m.failed && (
        <div className="bg-popover mb-1 hidden items-center rounded-full border p-0.5 shadow-sm group-hover:flex">
          <ReactionPicker onPick={(e) => onReact(e, false)} />
          <Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Reply" onClick={() => setReplyTo(m.roomId, m)}>
            <CornerUpLeft />
          </Button>
          {isMine && (
            <Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Edit" onClick={() => setEditing(m.roomId, m)}>
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="text-destructive size-7 rounded-full" aria-label="Delete" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
