import { format, isThisYear, isToday, isYesterday } from "date-fns";

/** Compact timestamp for the room list: 14:05, Yesterday, Mar 3, 03/03/24. */
export function formatRoomTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return isThisYear(d) ? format(d, "MMM d") : format(d, "dd/MM/yy");
}
