import { ApiError } from "./api";

/**
 * Changes made without a connection wait here (in this browser) and are sent once the device is
 * back online: new fill-ups, expenses and reminders, and edits and deletes of existing ones.
 */
export type OutboxKind = "entry" | "expense" | "reminder";
/** "create" (the default, for older queued items), or a change to the record `targetId`. */
export type OutboxOp = "create" | "update" | "delete";

export interface OutboxItem {
  /** Temporary id the record carries in the lists until the server gives it a real one. */
  localId: string;
  kind: OutboxKind;
  input: unknown;
  /** Only the account that added it sends it. */
  userId: string;
  op?: OutboxOp;
  /** The server record an update or delete is for. */
  targetId?: string;
}

const KEY = "carlog:outbox";
export const LOCAL_ID_PREFIX = "local-";

/** True for errors that mean "no connection", as opposed to the server refusing the record. */
export function isOfflineError(err: unknown): boolean {
  return (err instanceof ApiError && (err.status === 0 || err.status === 503)) || !navigator.onLine;
}

/** Not on the server yet: added offline, or edited/deleted offline and not sent yet. */
export function isPending(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX) || readAll().some((item) => item.targetId === id);
}

// The queue is read on every render (pending badges), so parse it again only when it changed.
let cachedRaw: string | null = null;
let cached: OutboxItem[] = [];

function readAll(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? "[]";
    if (raw !== cachedRaw) {
      cached = JSON.parse(raw) as OutboxItem[];
      cachedRaw = raw;
    }
    return cached;
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

/**
 * Queues an edit or delete of a server record. A newer change to the same record replaces the
 * older one (a delete after an edit just deletes).
 */
export function enqueueChange(op: "update" | "delete", kind: OutboxKind, targetId: string, input: unknown, userId: string): void {
  const others = readAll().filter((item) => item.targetId !== targetId);
  const localId = `${LOCAL_ID_PREFIX}chg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  write([...others, { localId, kind, input, userId, op, targetId }]);
}

export function replaceInOutbox(localId: string, input: unknown) {
  write(readAll().map((item) => (item.localId === localId ? { ...item, input } : item)));
}

export function dropFromOutbox(localId: string) {
  write(readAll().filter((item) => item.localId !== localId));
}
