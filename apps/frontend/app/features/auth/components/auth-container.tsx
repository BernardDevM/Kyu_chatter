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
    <div className="relative flex h-dvh w-full items-center justify-center overflow-y-auto p-4">
      <div className="from-primary/20 pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-card relative w-full max-w-sm rounded-2xl border p-6 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
            <MessagesSquare className="size-6" />
          </div>
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {siteConfig.name}
          </p>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        {children}
        <div className="text-muted-foreground mt-6 text-center text-sm">
          {footer}
        </div>
      </div>
    </div>
  );
}
