import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUserSearch } from "@/features/users/api/use-user-service";
import { UserAvatar } from "@/features/users/components/user-avatar";
import type { UserSummary } from "@/features/users/types/user";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/** Search users by name. `selected` + `onToggle` make it multi-select; omit for pick-one. */
export function UserPicker({
  selected = [],
  onToggle,
  onPick,
}: {
  selected?: UserSummary[];
  onToggle?: (user: UserSummary) => void;
  onPick?: (user: UserSummary) => void;
}) {
  const me = useCurrentUser();
  const [text, setText] = useState("");
  const q = useDebouncedValue(text, 250);
  const { data, isFetching } = useUserSearch(q);
  const results = (data ?? []).filter((u) => u.id !== me?.id);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle?.(u)}
              className="bg-accent text-accent-foreground flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs"
            >
              {u.name}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      <Command shouldFilter={false} className="rounded-lg border">
        <CommandInput
          placeholder="Search people by name…"
          value={text}
          onValueChange={setText}
        />
        <CommandList className="max-h-56">
          {q.trim().length < 2 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Type at least 2 letters
            </p>
          ) : isFetching ? (
            <div className="flex justify-center p-4">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (
            <>
              <CommandEmpty>No one found.</CommandEmpty>
              <CommandGroup>
                {results.map((u) => {
                  const isSelected = selected.some((s) => s.id === u.id);
                  return (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => (onPick ? onPick(u) : onToggle?.(u))}
                    >
                      <UserAvatar name={u.name} image={u.image} className="size-7" />
                      <span className="flex-1 truncate">{u.name}</span>
                      {isSelected && <Check className="text-primary size-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
