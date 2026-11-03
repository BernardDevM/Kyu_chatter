import { KyuMark } from "@/components/brand/kyu-mark";

export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="bg-background flex h-dvh w-full items-center justify-center"
    >
      <KyuMark className="text-primary size-10 animate-pulse" />
    </div>
  );
}
