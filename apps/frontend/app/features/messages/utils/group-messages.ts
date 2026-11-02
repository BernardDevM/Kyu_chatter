import { isSameDay } from "date-fns";

import type { Message } from "../types/message";

const GROUP_WINDOW_MS = 5 * 60_000;

export interface MessageRow {
  message: Message;
  /** first message of a run by the same sender: show avatar + name */
  startsGroup: boolean;
  /** first message of a new calendar day: show a date divider */
  startsDay: boolean;
}

export function toRows(messages: Message[]): MessageRow[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const sameDay = !!prev && isSameDay(new Date(prev.createdAt), new Date(message.createdAt));
    const sameRun =
      !!prev &&
      sameDay &&
      prev.senderId === message.senderId &&
      !prev.deletedAt &&
      new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() <
        GROUP_WINDOW_MS &&
      !message.replyToId;
    return { message, startsGroup: !sameRun, startsDay: !sameDay };
  });
}
