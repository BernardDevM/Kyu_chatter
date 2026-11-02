import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="bg-background flex h-dvh w-full items-center justify-center">
      <Loader2 className="text-primary size-8 animate-spin" />
    </div>
  );
}
