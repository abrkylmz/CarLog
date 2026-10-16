import { useCallback, useEffect, useState } from "react";
import { Bug, Car, ChevronLeft, CheckCircle2, Fuel, Inbox, Monitor, RotateCcw, Search } from "lucide-react";
import SupportConversation from "../../components/SupportConversation";
import { api, errorMessage, type SupportUserInfo } from "../../lib/api";
import { formatDate, formatRelative } from "../../lib/format";
import { planById } from "../../lib/plans";
import type { SupportStatus, SupportThread } from "../../types";
import { Avatar, RoleBadge } from "./UsersAdmin";

type Filter = "open" | "closed" | "all";

/** The staff's inbox: conversations on the left, the chat in the middle, who's asking on the right. */
export default function SupportDesk({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.staffThreads(filter);
      setThreads(list);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filter]);

  useEffect(() => {
    setThreads(null);
    void refresh();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (threads) onUnreadChange?.(threads.filter((t) => t.unread).length);
  }, [threads, onUnreadChange]);

  const q = search.trim().toLocaleLowerCase("tr");
  const visible = (threads ?? []).filter((t) => !q || (t.username ?? "").toLocaleLowerCase("tr").includes(q) || t.subject.toLocaleLowerCase("tr").includes(q));
  const current = threads?.find((t) => t.id === active) ?? null;

  async function setStatus(thread: SupportThread, status: SupportStatus) {
    try {
      await api.setThreadStatus(thread.id, status);
      await refresh();
      if (filter !== "all") setActive(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid h-[calc(100dvh-11rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:grid-cols-[19rem_1fr] xl:grid-cols-[20rem_1fr_18rem] dark:border-slate-800 dark:bg-slate-900">
      {/* Inbox */}
      <aside className={`${current ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-slate-100 dark:border-slate-800`}>
        <div className="space-y-3 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                ["open", "Açık"],
                ["closed", "Kapalı"],
                ["all", "Tümü"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setActive(null);
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${filter === key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kişi ya da konu ara" aria-label="Konuşma ara" className="input w-full !py-2 !pl-9 text-sm" />
          </label>
        </div>
        {error ? <p className="px-4 py-2 text-xs text-red-600">{error}</p> : null}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {threads == null
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="p-3">
                  <div className="skeleton h-14 rounded-xl" />
                </li>
              ))
            : visible.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActive(t.id)}
                    className={`flex w-full gap-3 border-l-2 px-4 py-3 text-left transition ${
                      t.id === active ? "border-brand-500 bg-brand-50/70 dark:bg-brand-900/20" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Avatar name={t.username ?? "?"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-sm ${t.unread ? "font-bold" : "font-semibold"}`}>{t.username ?? "Silinmiş kullanıcı"}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatRelative(t.lastMessageAt)}</span>
                      </span>
                      <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">{t.subject}</span>
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-xs ${t.unread ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                          {t.lastFromStaff ? "Siz: " : ""}
                          {t.lastMessage}
                        </span>
                        {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Okunmadı" /> : null}
                        {t.status === "closed" ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" aria-label="Kapatıldı" /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          {threads && visible.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-slate-500">
              <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
              {filter === "open" ? "Bekleyen konuşma yok. Harika!" : "Konuşma yok."}
            </li>
          ) : null}
        </ul>
      </aside>

      {/* Conversation */}
      <section className={`${current ? "flex" : "hidden md:flex"} min-h-0 flex-col bg-slate-50/60 dark:bg-slate-950/40`}>
        {current ? (
          <>
            <header className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
              <button type="button" onClick={() => setActive(null)} aria-label="Konuşmalara dön" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800">
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{current.subject}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {current.username} · {formatDate(current.createdAt)}
                  {current.context ? ` · ${current.context}` : ""}
                </p>
              </div>
              {current.status === "open" ? (
                <button type="button" onClick={() => void setStatus(current, "closed")} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                  <CheckCircle2 size={14} />
                  Çözüldü
                </button>
              ) : (
                <button type="button" onClick={() => void setStatus(current, "open")} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                  <RotateCcw size={14} />
                  Yeniden aç
                </button>
              )}
            </header>
            <SupportConversation key={current.id} threadId={current.id} staffView onActivity={() => void refresh()} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
            <Inbox size={32} className="text-slate-300 dark:text-slate-600" />
            Yanıtlamak için soldan bir konuşma seçin.
          </div>
        )}
      </section>

      {/* Who's asking */}
      <aside className="hidden min-h-0 overflow-y-auto border-l border-slate-100 xl:block dark:border-slate-800">
        {current ? <UserPanel key={current.id} threadId={current.id} /> : null}
      </aside>
    </div>
  );
}

function UserPanel({ threadId }: { threadId: string }) {
  const [info, setInfo] = useState<SupportUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.supportUser(threadId).then(setInfo, (err) => setError(errorMessage(err)));
  }, [threadId]);

  if (error) return <p className="p-4 text-xs text-red-600">{error}</p>;
  if (!info)
    return (
      <div className="space-y-3 p-4">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-col items-center text-center">
        <Avatar name={info.username} size="h-14 w-14 text-lg" />
        <p className="mt-2 font-semibold">{info.username}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <RoleBadge role={info.role} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{planById(info.plan).name}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <Car size={16} className="mx-auto text-slate-400" />
          <dd className="mt-1 text-lg font-bold">{info.ownedVehicles}</dd>
          <dt className="text-[11px] text-slate-500">Araç</dt>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <Fuel size={16} className="mx-auto text-slate-400" />
          <dd className="mt-1 text-lg font-bold">{info.fillUps}</dd>
          <dt className="text-[11px] text-slate-500">Dolum</dt>
        </div>
      </dl>
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Üyelik</dt>
          <dd className="font-medium">{formatDate(info.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Son giriş</dt>
          <dd className="font-medium">{info.lastSeenAt ? formatRelative(info.lastSeenAt) : "—"}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Bug size={13} />
          Son hataları
        </p>
        {info.recentErrors.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">Kayıtlı hata yok.</p>
        ) : (
          <ul className="space-y-2">
            {info.recentErrors.map((e, i) => (
              <li key={i} className="rounded-xl bg-red-50 p-2.5 text-xs dark:bg-red-950/30">
                <p className="break-words font-medium text-red-700 dark:text-red-300">{e.message}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600/70 dark:text-red-300/60">
                  <Monitor size={10} />
                  {formatRelative(e.at)}
                  {e.url ? ` · ${e.url}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
