import { ApiError } from "./api";

/**
 * Records added without a connection wait here (in this browser) and are sent once the device
 * is back online. Only new fill-ups, expenses and reminders are queued; edits and deletes need
 * the server to confirm them.
 */
export type OutboxKind = "entry" | "expense" | "reminder";

export interface OutboxItem {
  /** Temporary id the record carries in the lists until the server gives it a real one. */
  localId: string;
  kind: OutboxKind;
  input: unknown;
  /** Only the account that added it sends it. */
  userId: string;
}

const KEY = "carlog:outbox";
export const LOCAL_ID_PREFIX = "local-";

/** True for errors that mean "no connection", as opposed to the server refusing the record. */
export function isOfflineError(err: unknown): boolean {
  return (err instanceof ApiError && (err.status === 0 || err.status === 503)) || !navigator.onLine;
}

export function isPending(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

function readAll(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

export function readOutbox(userId: string): OutboxItem[] {
  return readAll().filter((item) => item.userId === userId);
}

function write(items: OutboxItem[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): the record stays only in memory.
  }
}

export function enqueue(kind: OutboxKind, input: unknown, userId: string): string {
  const localId = `${LOCAL_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  write([...readAll(), { localId, kind, input, userId }]);
  return localId;
}

export function replaceInOutbox(localId: string, input: unknown) {
  write(readAll().map((item) => (item.localId === localId ? { ...item, input } : item)));
}

export function dropFromOutbox(localId: string) {
  write(readAll().filter((item) => item.localId !== localId));
}
