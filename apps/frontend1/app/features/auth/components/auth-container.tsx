import { MessagesSquare } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { siteConfig } from "@/config/site";

export function AuthContainer({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid h-dvh w-full overflow-y-auto lg:grid-cols-2">
      {/* brand panel */}
      <div className="bg-primary text-primary-foreground relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/15 flex size-11 items-center justify-center rounded-2xl">
            <MessagesSquare className="size-6" />
          </div>
          <span className="font-display text-xl font-semibold">{siteConfig.name}</span>
        </div>
        <div className="space-y-4">
          <p className="font-display text-5xl leading-tight font-semibold">
            Conversations that keep going.
          </p>
          <p className="text-primary-foreground/80 max-w-md text-lg">
            {siteConfig.description}
          </p>
        </div>
        <div className="bg-primary-foreground/10 pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full" />
        <div className="bg-primary-foreground/10 pointer-events-none absolute right-24 -bottom-48 size-96 rounded-full" />
      </div>

      {/* form panel */}
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <div className="bg-primary text-primary-foreground mb-4 flex size-11 items-center justify-center rounded-2xl lg:hidden">
              <MessagesSquare className="size-6" />
            </div>
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <div className="text-muted-foreground mt-8 text-sm">{footer}</div>
        </div>
      </div>
    </div>
  );
}
