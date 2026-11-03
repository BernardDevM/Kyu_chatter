import type { ReactNode } from "react";

import { KyuMark } from "@/components/brand/kyu-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const PREVIEW = [
  { mine: false, who: "Wanjiru", text: "Is the deploy finished?" },
  { mine: true, text: "Rolled out. node-2 died halfway." },
  { mine: false, who: "Wanjiru", text: "Did we lose anything?" },
  { mine: true, text: "Not a single message." },
] as const;

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
    <div className="h-dvh w-full overflow-y-auto p-0 lg:p-3">
      <div className="grid min-h-full gap-3 lg:min-h-[calc(100dvh-1.5rem)] lg:grid-cols-[1.05fr_1fr]">
        {/* brand panel: clipped, so the oversized wordmark never adds scroll */}
        <aside className="bg-rail text-rail-foreground relative hidden overflow-hidden rounded-[2rem] lg:block">
          <span
            aria-hidden="true"
            className="font-display text-signal pointer-events-none absolute -bottom-[0.16em] -left-[0.03em] text-[min(15rem,26vw)] leading-none font-extrabold tracking-tighter select-none"
          >
            kyu
          </span>
          <div className="relative flex h-full flex-col gap-10 p-10">
            <div className="flex items-center gap-2.5">
              <KyuMark className="text-signal size-7" />
              <span className="font-display text-xl font-bold">kyu chatter</span>
            </div>

            <div className="flex max-w-sm flex-col gap-2">
              {PREVIEW.map((m, i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${300 + i * 700}ms` }}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both motion-reduce:animate-none max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] duration-500",
                    m.mine
                      ? "bg-signal text-signal-foreground self-end rounded-br-md"
                      : "bg-white/10 self-start rounded-bl-md",
                  )}
                >
                  {m.text}
                </div>
              ))}
              <p
                style={{ animationDelay: `${300 + PREVIEW.length * 700}ms` }}
                className="animate-in fade-in fill-mode-both motion-reduce:animate-none text-rail-foreground/70 mt-3 flex items-center gap-2 font-mono text-xs duration-700"
              >
                <span className="bg-signal size-1.5 rounded-full" />
                node-2 went offline. Traffic moved to node-3.
              </p>
            </div>
          </div>
        </aside>

        {/* form panel */}
        <main className="bg-card relative flex min-h-dvh items-center justify-center px-6 py-10 lg:min-h-0 lg:rounded-[2rem]">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-sm">
            <div className="text-primary mb-10 flex items-center gap-2 lg:hidden">
              <KyuMark className="size-6" />
              <span className="font-display text-lg font-bold">kyu chatter</span>
            </div>
            <div className="mb-8 space-y-2">
              <h1 className="text-3xl leading-tight font-extrabold">{title}</h1>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>
            {children}
            <div className="text-muted-foreground mt-8 text-sm">{footer}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
