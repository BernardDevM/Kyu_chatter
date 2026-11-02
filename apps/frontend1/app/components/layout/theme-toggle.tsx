import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { appTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(appTheme === "dark" ? "light" : "dark")}
    >
      {appTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
