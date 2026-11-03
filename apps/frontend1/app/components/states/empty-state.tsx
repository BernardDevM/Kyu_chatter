import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="bg-signal text-signal-foreground flex size-14 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
