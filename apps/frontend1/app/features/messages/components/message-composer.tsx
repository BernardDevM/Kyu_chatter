import { CornerUpLeft, FileIcon, Loader2, Paperclip, Pencil, Send, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { v7 as uuidv7 } from "uuid";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMediaUpload } from "@/features/media/hooks/use-media-upload";
import type { MediaItem } from "@/features/media/types/media";
import { useTypingEmitter } from "@/features/realtime/hooks/use-typing-emitter";
import { handleError } from "@/lib/handle-error";

import { useEditMessage, useSendMessage } from "../api/use-message-service";
import { useComposerStore } from "../stores/composer-store";
import { EmojiPicker } from "./emoji-picker";

const MAX_LENGTH = 2000; // websocket limit (REST allows 4000)
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;

export function MessageComposer({ roomId }: { roomId: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);

  const replyTo = useComposerStore((s) => s.replyTo[roomId]);
  const editing = useComposerStore((s) => s.editing[roomId]);
  const { setReplyTo, setEditing } = useComposerStore();

  const send = useSendMessage(roomId);
  const edit = useEditMessage(roomId);
  const upload = useMediaUpload();
  const typing = useTypingEmitter(roomId);

  // Entering edit mode loads the message body; reply mode just focuses.
  useEffect(() => {
    if (editing) setText(editing.body ?? "");
    if (editing || replyTo) input.current?.focus();
  }, [editing, replyTo]);

  const onDrop = async (accepted: File[]) => {
    const room = MAX_FILES - files.length;
    for (const file of accepted.slice(0, Math.max(room, 0))) {
      if (file.size > MAX_BYTES) {
        handleError(new Error(`${file.name} is larger than 25 MB`));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const media = await upload.mutateAsync(file);
        setFiles((f) => [...f, media]);
      } catch {
        /* toast shown by the hook */
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled: !!editing,
  });

  const body = text.trim();
  const canSend = (body.length > 0 || files.length > 0) && uploading === 0;

  const submit = () => {
    if (!canSend) return;
    typing.stop();

    if (editing) {
      if (body && body !== editing.body)
        edit.mutate({ id: editing.id, body });
      setEditing(roomId, undefined);
      setText("");
      return;
    }

    send.mutate({
      clientMessageId: uuidv7(),
      body: body || undefined,
      replyToId: replyTo?.id,
      mediaIds: files.length ? files.map((f) => f.id) : undefined,
      attachments: files,
    });
    setText("");
    setFiles([]);
    setReplyTo(roomId, undefined);
  };

  const insertEmoji = (emoji: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (next.length > MAX_LENGTH) return;
    setText(next);
    if (!editing) typing.notify();
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const cancelContext = () => {
    setReplyTo(roomId, undefined);
    if (editing) {
      setEditing(roomId, undefined);
      setText("");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      cancelContext();
    }
  };

  return (
    <div {...getRootProps()} className="shrink-0 px-3 pb-3 md:px-6 md:pb-5">
      <input {...getInputProps()} />
      <div
        className={`bg-muted overflow-hidden rounded-3xl border-0 shadow-sm transition-colors ${isDragActive ? "ring-primary/50 ring-2" : ""}`}
      >
        {(replyTo || editing) && (
          <div className="text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs">
            {editing ? <Pencil className="size-3" /> : <CornerUpLeft className="size-3" />}
            <span className="flex-1 truncate">
              {editing
                ? "Editing message"
                : `Replying to ${replyTo?.sender.name}: ${replyTo?.body ?? "Attachment"}`}
            </span>
            <button type="button" onClick={cancelContext} aria-label="Cancel">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {(files.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-2 border-b p-2">
            {files.map((f) => (
              <span
                key={f.id}
                className="bg-secondary flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2 text-xs"
              >
                {f.kind === "IMAGE" ? (
                  <img src={f.url} alt="" className="size-6 rounded object-cover" />
                ) : (
                  <FileIcon className="size-3.5" />
                )}
                <span className="max-w-32 truncate">{f.storageKey?.split("/").at(-1) ?? f.kind}</span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {uploading > 0 && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> Uploading…
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-1 p-1.5">
          {!editing && (
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Attach files" onClick={open}>
              <Paperclip />
            </Button>
          )}
          <EmojiPicker onPick={insertEmoji} className="rounded-full" />
          <Textarea
            ref={input}
            value={text}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Write a message…"
            onChange={(e) => {
              setText(e.target.value);
              if (!editing && e.target.value) typing.notify();
            }}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button size="icon" className="bg-signal text-signal-foreground hover:bg-signal/90 rounded-full" aria-label="Send" disabled={!canSend} onClick={submit}>
            <Send />
          </Button>
        </div>
      </div>
    </div>
  );
}
