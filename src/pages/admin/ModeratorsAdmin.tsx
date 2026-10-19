import { useEffect, useState } from "react";
import { Headset, ShieldHalf, UserMinus, UserPlus } from "lucide-react";
import { useDialog } from "../../components/DialogProvider";
import { api, errorMessage } from "../../lib/api";
import { formatRelative } from "../../lib/format";
import type { User } from "../../types";
import { Avatar, NewUserModal, RoleBadge } from "./UsersAdmin";
import { changeRole } from "./userActions";

/** The support team: who can answer users, adding someone (new or existing) and taking the role back. */
export default function ModeratorsAdmin({ currentUser }: { currentUser: User }) {
  const dialog = useDialog();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [promote, setPromote] = useState("");

  useEffect(() => {
    api.listUsers().then(setUsers, (err) => setError(errorMessage(err)));
  }, []);

  const replace = (user: User) => setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, ...user } : u)) ?? null);
  const team = (users ?? []).filter((u) => u.role !== "user");
  const candidates = (users ?? []).filter((u) => u.role === "user").sort((a, b) => a.username.localeCompare(b.username, "tr"));

  async function handlePromote() {
    const user = candidates.find((u) => u.id === promote);
    if (!user) return;
    const updated = await changeRole(dialog, user, "moderator");
    if (updated) {
      replace(updated);
      setPromote("");
    }
  }

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="font-semibold">Destek ekibi</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{team.length} kişi canlı desteği yanıtlayabilir</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <UserPlus size={16} />
            Yeni moderatör
          </button>
        </header>
        {users == null ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {team.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={u.username} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {u.username}
                    <RoleBadge role={u.role} />
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Son giriş: {u.lastSeenAt ? formatRelative(u.lastSeenAt) : "—"}</p>
                </div>
                {u.role === "moderator" && u.id !== currentUser.id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = await changeRole(dialog, u, "user");
                      if (updated) replace(updated);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <UserMinus size={14} />
                    Yetkiyi al
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="font-semibold">Mevcut kullanıcıyı moderatör yap</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Kişinin hesabı ve verileri olduğu gibi kalır.</p>
          <div className="flex gap-2">
            <select value={promote} onChange={(e) => setPromote(e.target.value)} aria-label="Kullanıcı seçin" className="input min-w-0 flex-1">
              <option value="">Kullanıcı seçin…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
            <button type="button" disabled={!promote} onClick={() => void handlePromote()} className="rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900">
              Ekle
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-brand-700 p-5 text-white shadow-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldHalf size={18} />
            Moderatörler neler yapabilir?
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li className="flex gap-2">
              <Headset size={16} className="mt-0.5 shrink-0" />
              Canlı destekte kullanıcıları yanıtlar, konuşmaları kapatır.
            </li>
            <li>• Hata kayıtlarını görür (silemez).</li>
            <li>• Kullanıcıları, rolleri, paketleri ve kataloğu değiştiremez.</li>
            <li>• Başkalarının araç ve kayıtlarını göremez.</li>
          </ul>
        </div>
      </aside>

      {creating ? (
        <NewUserModal
          initialRole="moderator"
          onClose={() => setCreating(false)}
          onCreated={(user) => {
            setUsers((prev) => [...(prev ?? []), user]);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}
