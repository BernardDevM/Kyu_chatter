import { Smile } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EMOJI_CATEGORIES, searchEmojis } from "../utils/emoji-data";

export function EmojiPicker({
  onPick,
  disabled,
  className,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(EMOJI_CATEGORIES[0].id);

  const results = searchEmojis(query);
  const searching = query.trim().length > 0;
  const category = EMOJI_CATEGORIES.find((c) => c.id === active) ?? EMOJI_CATEGORIES[0];
  const shown = searching ? results : category.emojis.map(([e]) => e);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Add emoji"
          disabled={disabled}
        >
          <Smile />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 pb-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="h-9"
          />
        </div>
        {!searching && (
          <div className="flex gap-0.5 border-b px-2 pb-1" role="tablist" aria-label="Emoji categories">
            {EMOJI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === active}
                aria-label={c.label}
                title={c.label}
                onClick={() => setActive(c.id)}
                className={cn(
                  "flex-1 rounded-md py-1 text-base transition-colors",
                  c.id === active ? "bg-accent" : "hover:bg-muted",
                )}
              >
                {c.icon}
              </button>
            ))}
          </div>
        )}
        <div className="h-56 overflow-y-auto p-2">
          {!searching && (
            <p className="text-muted-foreground mb-1 text-xs font-medium">{category.label}</p>
          )}
          {shown.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No emoji found</p>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {shown.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="hover:bg-accent rounded-md py-1 text-xl"
                  onClick={() => {
                    onPick(e);
                    changeOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
