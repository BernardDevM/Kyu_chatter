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
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-7" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
