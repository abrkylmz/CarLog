import { useEffect, useState } from "react";
import { Bug, Monitor, Server, Trash2 } from "lucide-react";
import { api, errorMessage, type AppErrorReport } from "../lib/api";
import { formatRelative } from "../lib/format";
import { useDialog } from "./DialogProvider";

/** The admin's error log: what failed in users' browsers or on the server, newest first. */
export default function ErrorsAdmin() {
  const dialog = useDialog();
  const [errors, setErrors] = useState<AppErrorReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.listErrors().then(setErrors, (err) => setLoadError(errorMessage(err)));
  }, []);

  async function clear() {
    if (!(await dialog.confirm({ title: "Hata kayıtları silinsin mi?", message: "Listedeki tüm kayıtlar silinir.", tone: "danger", confirmLabel: "Sil" }))) return;
    await api.clearErrors();
    setErrors([]);
  }

  if (loadError) return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  if (!errors) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  // The same message counted once, with how often and when it last happened.
  const groups = new Map<string, { latest: AppErrorReport; count: number; users: Set<string> }>();
  for (const e of errors) {
    const key = `${e.source}|${e.message}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (e.username) g.users.add(e.username);
    } else groups.set(key, { latest: e, count: 1, users: new Set(e.username ? [e.username] : []) });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kullanıcıların tarayıcısında ve sunucuda oluşan hatalar (son 200 kayıt). Aynı hata bir kez listelenir.
        </p>
        {errors.length ? (
          <button type="button" onClick={clear} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
            <Trash2 size={15} />
            Temizle
          </button>
        ) : null}
      </div>
      {groups.size === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
          <Bug size={16} />
          Kayıtlı hata yok.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {[...groups.values()].map(({ latest: e, count, users }) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-start gap-3 text-left">
                {e.source === "server" ? <Server size={16} className="mt-0.5 shrink-0 text-violet-500" /> : <Monitor size={16} className="mt-0.5 shrink-0 text-brand-500" />}
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{e.message}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {e.source === "server" ? "Sunucu" : "Tarayıcı"} · {count} kez · son {formatRelative(e.at)}
                    {users.size ? ` · ${[...users].slice(0, 3).join(", ")}` : ""}
                    {e.url ? ` · ${e.url}` : ""}
                  </span>
                </span>
              </button>
              {open === e.id ? (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {e.stack || "Ayrıntı yok."}
                  {e.userAgent ? `\n\n${e.userAgent}` : ""}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
