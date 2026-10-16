import { useEffect, useRef, useState } from "react";
import { Headset, Loader2, SendHorizontal } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { SupportMessage, SupportStatus } from "../types";

/** How often an open conversation checks for new messages. */
const POLL_MS = 4000;

const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/**
 * One support conversation: the messages, kept up to date while open, and a box to reply.
 * `staffView` puts the staff's messages on the right (they're "me" there).
 */
export default function SupportConversation({
  threadId,
  staffView = false,
  onActivity,
}: {
  threadId: string;
  staffView?: boolean;
  /** After a message is sent or received, so lists can refresh their previews. */
  onActivity?: (status: SupportStatus) => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [status, setStatus] = useState<SupportStatus>("open");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef<string | undefined>(undefined);
  const activity = useRef(onActivity);
  activity.current = onActivity;

  useEffect(() => {
    let stopped = false;
    latest.current = undefined;
    setMessages(null);
    async function load() {
      try {
        const res = await api.supportMessages(threadId, latest.current);
        if (stopped) return;
        setStatus(res.status);
        if (res.messages.length || latest.current === undefined) {
          setMessages((prev) => {
            const known = new Set((prev ?? []).map((m) => m.id));
            return [...(prev ?? []), ...res.messages.filter((m) => !known.has(m.id))];
          });
          if (res.messages.length) {
            latest.current = res.messages[res.messages.length - 1].createdAt;
            if (latest.current) activity.current?.(res.status);
          }
        }
      } catch (err) {
        if (!stopped) setError(errorMessage(err));
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [threadId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.sendSupport(threadId, body);
      setMessages((prev) => [...(prev ?? []), message]);
      latest.current = message.createdAt;
      setDraft("");
      setStatus("open");
      activity.current?.("open");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messages == null ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Yükleniyor…
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = staffView ? m.fromStaff : !m.fromStaff;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    {!mine ? (
                      <span className="flex items-center gap-1 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {m.fromStaff ? <Headset size={12} className="text-brand-500" /> : null}
                        {m.fromStaff ? `${m.sender ?? "Destek"} · CarLog Destek` : (m.sender ?? "Kullanıcı")}
                      </span>
                    ) : null}
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                        mine
                          ? "rounded-br-md bg-brand-600 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="px-1 text-[10px] text-slate-400">{time(m.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {status === "closed" ? (
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Bu konuşma kapatıldı. {staffView ? "" : "Yeni bir mesaj yazarsanız yeniden açılır."}
          </p>
        ) : null}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        {error ? <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={staffView ? "Yanıt yazın… (Enter gönderir, Shift+Enter yeni satır)" : "Mesajınızı yazın…"}
            aria-label="Mesaj"
            className="input max-h-36 min-h-[2.75rem] flex-1 resize-none py-2.5"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Gönder"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
