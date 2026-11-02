import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges Tailwind class names, letting later classes win over earlier ones:
//   cn("px-2", isActive && "px-4") -> "px-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
