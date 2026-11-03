import { SmilePlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ReactionSummary } from "../types/message";

export const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

export function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string, hasReacted: boolean) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {reactions
        .filter((r) => r.count > 0)
        .map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji, r.hasReacted)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              r.hasReacted
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "hover:bg-accent",
            )}
          >
            <span>{r.emoji}</span>
            <span className="tabular-nums">{r.count}</span>
          </button>
        ))}
    </div>
  );
}

export function ReactionPicker({
  onPick,
  onOpenChange,
}: {
  onPick: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Add reaction">
          <SmilePlus />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto gap-1 p-1.5" align="end">
        {QUICK_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            className="hover:bg-accent rounded-md p-1.5 text-lg"
            onClick={() => {
              onPick(e);
              changeOpen(false);
            }}
          >
            {e}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
