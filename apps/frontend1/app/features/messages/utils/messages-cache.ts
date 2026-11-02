import type { InfiniteData } from "@tanstack/react-query";

import type { Message, Page, ReactionSummary } from "../types/message";

export type MessagesData = InfiniteData<Page<Message>, unknown>;

/** Cache entries are pages (newest page first). Flatten to one oldest-first list. */
export function flattenMessages(data: MessagesData | undefined): Message[] {
  if (!data) return [];
  const byId = new Map<string, Message>();
  for (const page of data.pages)
    for (const m of page.items) byId.set(m.id, m);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

function mapMessages(
  data: MessagesData,
  fn: (m: Message) => Message,
): MessagesData {
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, items: p.items.map(fn) })),
  };
}

function find(data: MessagesData, msg: Pick<Message, "id" | "clientMessageId">) {
  return data.pages.some((p) =>
    p.items.some(
      (m) => m.id === msg.id || m.clientMessageId === msg.clientMessageId,
    ),
  );
}

/**
 * Insert or replace a message. A server message replaces its optimistic copy
 * (matched by clientMessageId), so a send never shows twice.
 */
export function upsertMessage(
  data: MessagesData | undefined,
  msg: Message,
): MessagesData | undefined {
  if (!data) return data;
  if (find(data, msg)) {
    return mapMessages(data, (m) =>
      m.id === msg.id || m.clientMessageId === msg.clientMessageId
        ? { ...msg, pending: false, failed: false }
        : m,
    );
  }
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return { ...data, pages: [{ ...first, items: [...first.items, msg] }, ...rest] };
}

export function patchMessage(
  data: MessagesData | undefined,
  id: string,
  patch: Partial<Message>,
): MessagesData | undefined {
  if (!data) return data;
  return mapMessages(data, (m) => (m.id === id ? { ...m, ...patch } : m));
}

export function patchByClientId(
  data: MessagesData | undefined,
  clientMessageId: string,
  patch: Partial<Message>,
): MessagesData | undefined {
  if (!data) return data;
  return mapMessages(data, (m) =>
    m.clientMessageId === clientMessageId ? { ...m, ...patch } : m,
  );
}

export function setReactions(
  data: MessagesData | undefined,
  id: string,
  reactions: ReactionSummary[],
) {
  return patchMessage(data, id, { reactions });
}

/** Last server-confirmed message (used as the resync cursor). */
export function lastConfirmedId(data: MessagesData | undefined) {
  const confirmed = flattenMessages(data).filter((m) => !m.pending && !m.failed);
  return confirmed.at(-1)?.id;
}
