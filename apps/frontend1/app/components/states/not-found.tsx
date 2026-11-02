import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-primary text-6xl font-bold">404</p>
      <h1 className="text-xl font-semibold">This page does not exist</h1>
      <Button asChild>
        <Link to="/chat">Back to chats</Link>
      </Button>
    </div>
  );
}
