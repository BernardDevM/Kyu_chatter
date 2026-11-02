import "./styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { NotFound } from "@/components/states/not-found";
import { DefaultCatchBoundary } from "@/components/states/try-catch-boundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/providers/theme-provider";

// Dev-only, dynamically imported so it never ships in the prod bundle.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;

export const meta = () => [
  { title: siteConfig.name },
  { name: "description", content: siteConfig.description },
];

// ─── Layout: document shell only, NO router hooks ───────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body className="overflow-hidden">
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            <ScrollRestoration />
            <Scripts />
            {ReactQueryDevtools && (
              <Suspense fallback={null}>
                <ReactQueryDevtools
                  buttonPosition="bottom-left"
                  initialIsOpen={false}
                />
              </Suspense>
            )}
            <Toaster position="top-center" richColors />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// ─── App: root route, HAS router context ────────────────────────────────────
export default function App() {
  return <Outlet />;
}

// Nothing to show while the SPA boots; the themed body background is enough.
export function HydrateFallback() {
  return null;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return <DefaultCatchBoundary error={error} />;
}
