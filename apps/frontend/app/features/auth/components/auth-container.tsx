import type { CSSProperties, ReactNode } from "react";

import { KyuMark } from "@/components/brand/kyu-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const CLIENT = { x: 36, y: 120 };
const NODES = [
  { id: "node-1", x: 300, y: 36, d: "M36 120C140 120 190 36 300 36" },
  { id: "node-2", x: 300, y: 120, d: "M36 120L300 120" },
  { id: "node-3", x: 300, y: 204, d: "M36 120C140 120 190 204 300 204" },
] as const;

/** A request fans out to three nodes; the middle one drops out and back. */
function FailoverDiagram() {
  return (
    <svg
      viewBox="0 0 400 240"
      className="w-full max-w-md"
      role="img"
      aria-label="Messages keep flowing to two nodes while a third goes offline"
    >
      {NODES.map((n, i) => (
        <g key={n.id} className={i === 1 ? "kyu-node-mid" : undefined}>
          <path d={n.d} stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5" fill="none" />
          {[0, 1.2].map((delay) => (
            <circle
              key={delay}
              r="3.5"
              className="kyu-packet fill-current"
              style={
                {
                  offsetPath: `path('${n.d}')`,
                  animationDelay: `${delay + i * 0.4}s`,
                } as CSSProperties
              }
            />
          ))}
          <circle cx={n.x} cy={n.y} r="13" className="fill-white" />
          <circle cx={n.x} cy={n.y} r="5" className="fill-[oklch(0.44_0.26_266)]" />
          <text
            x={n.x + 24}
            y={n.y + 4}
            className="fill-current font-mono text-[11px]"
            fillOpacity=".8"
          >
            {n.id}
          </text>
        </g>
      ))}
      <circle cx={CLIENT.x} cy={CLIENT.y} r="9" className="fill-current" />
    </svg>
  );
}

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
    <div className="h-dvh w-full overflow-y-auto">
      <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
        {/* brand panel: clipped so its glow never adds page scroll */}
        <aside className="relative hidden overflow-hidden bg-[oklch(0.44_0.26_266)] text-white lg:block">
          <div className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex h-full min-h-dvh flex-col justify-between p-12">
            <div className="flex items-center gap-2.5">
              <KyuMark className="size-7" />
              <span className="font-display text-2xl font-bold tracking-tight">kyu</span>
            </div>

            <div className="space-y-10">
              <FailoverDiagram />
              <div className="space-y-4">
                <h2 className="font-display max-w-md text-5xl leading-[1.02] font-bold tracking-tight">
                  Chat that survives a dead server.
                </h2>
                <p className="text-white/75 relative h-5 font-mono text-xs">
                  <span className="kyu-say-ok absolute inset-0">3 of 3 nodes healthy</span>
                  <span className="kyu-say-down text-signal absolute inset-0">
                    node-2 offline. Traffic rerouted.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* form panel */}
        <main className="relative flex min-h-dvh items-center justify-center px-6 py-10">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-sm">
            <div className="text-primary mb-10 flex items-center gap-2 lg:hidden">
              <KyuMark className="size-6" />
              <span className="font-display text-xl font-bold tracking-tight">kyu</span>
            </div>
            <div className="mb-8 space-y-1.5">
              <h1 className="text-3xl font-bold">{title}</h1>
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
