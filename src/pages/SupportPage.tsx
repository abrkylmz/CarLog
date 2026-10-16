import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Headset, MessageSquarePlus, Plus } from "lucide-react";
import BackLink from "../components/BackLink";
import SupportConversation from "../components/SupportConversation";
import { api, errorMessage } from "../lib/api";
import { formatRelative } from "../lib/format";
import type { SupportThread } from "../types";

/** The page and device a message is sent from, so the team can reproduce a problem. */
function describeContext(): string {
  const ua = navigator.userAgent;
  const device = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Diğer";
  const app = window.matchMedia("(display-mode: standalone)").matches ? "ana ekrandan" : "tarayıcıdan";
  return `${device}, ${app}, ${window.innerWidth}×${window.innerHeight}`;
}

/**
 * "Canlı Destek" for users: their conversations with the CarLog team, and a new one. Replies arrive
 * while the page is open, and as a notification when it isn't (if notifications are on).
 */
export default function SupportPage() {
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.supportThreads();
      setThreads(list);
      return list;
    } catch (err) {
      setError(errorMessage(err));
      return [];
    }
  }, []);

  useEffect(() => {
    void refresh().then((list) => {
      if (list.length === 0) setComposing(true);
      else if (window.matchMedia("(min-width: 768px)").matches) setActive(list[0].id);
    });
    const timer = window.setInterval(() => document.visibilityState === "visible" && void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const current = threads?.find((t) => t.id === active) ?? null;
  const showList = !active && !composing;

  return (
    <>
      <BackLink />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Headset size={24} className="text-brand-600" />
            Canlı Destek
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bir hata mı gördünüz ya da bir sorunuz mu var? Ekibimize yazın; yanıtlar burada ve bildirim olarak gelir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposing(true);
            setActive(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus size={16} />
          Yeni konuşma
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="grid h-[max(24rem,calc(100dvh-22rem))] md:h-[min(70vh,44rem)] md:min-h-[28rem] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm md:grid-cols-[18rem_1fr] dark:border-slate-800 dark:bg-slate-950">
        <aside className={`${showList ? "flex" : "hidden"} min-h-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-900`}>
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">Konuşmalarım</p>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {(threads ?? []).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(t.id);
                    setComposing(false);
                  }}
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left transition dark:border-slate-800 ${
                    t.id === active ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.subject}</span>
                    {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Yeni yanıt" /> : null}
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.lastFromStaff ? "Destek: " : "Siz: "}
                    {t.lastMessage}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {t.status === "closed" ? "Kapatıldı · " : ""}
                    {formatRelative(t.lastMessageAt)}
                  </span>
                </button>
              </li>
            ))}
            {threads?.length === 0 ? <li className="px-4 py-6 text-sm text-slate-500">Henüz bir konuşmanız yok.</li> : null}
          </ul>
        </aside>

        <section className={`${showList ? "hidden" : "flex"} min-h-0 flex-col md:flex`}>
          {composing ? (
            <NewConversation
              onBack={() => setComposing(false)}
              onCreated={async (thread) => {
                await refresh();
                setComposing(false);
                setActive(thread.id);
              }}
            />
          ) : current ? (
            <>
              <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => setActive(null)} aria-label="Konuşmalara dön" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800">
                  <ChevronLeft size={20} />
                </button>
                <p className="min-w-0 flex-1 truncate font-semibold">{current.subject}</p>
              </header>
              <SupportConversation key={current.id} threadId={current.id} onActivity={() => void refresh()} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              <MessageSquarePlus size={28} className="text-slate-400" />
              Bir konuşma seçin ya da yeni bir konuşma başlatın.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function NewConversation({ onCreated, onBack }: { onCreated: (thread: SupportThread) => void; onBack: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return setError("Mesajınızı yazın.");
        setSending(true);
        setError(null);
        try {
          onCreated(await api.startSupport(subject.trim(), body.trim(), describeContext()));
        } catch (err) {
          setError(errorMessage(err));
          setSending(false);
        }
      }}
      className="flex flex-1 flex-col gap-3 overflow-y-auto bg-white p-4 sm:p-6 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Geri" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold">Yeni konuşma</h3>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Konu</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder="Örn. Dolum kaydedilmiyor" className="input" />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Mesajınız</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={6}
          placeholder="Ne oldu, hangi ekranda? Ne kadar ayrıntı verirseniz o kadar hızlı yardımcı olabiliriz."
          className="input min-h-[9rem] flex-1 resize-none"
          required
        />
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">Kullandığınız cihaz ve ekran boyutu da ekibe iletilir; sorunu görmelerine yardımcı olur.</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={sending} className="self-end rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {sending ? "Gönderiliyor…" : "Gönder"}
      </button>
    </form>
  );
}
