import { useEffect, useMemo, useState } from "react";
import { KeyRound, Search, Trash2, UserPlus } from "lucide-react";
import Modal from "../../components/Modal";
import { useDialog } from "../../components/DialogProvider";
import { api, errorMessage } from "../../lib/api";
import { formatDate, formatRelative } from "../../lib/format";
import { planById, PLANS, type PlanId } from "../../lib/plans";
import type { Role, User } from "../../types";
import { changeRole, deleteAccount, resetPassword, ROLE_LABELS } from "./userActions";

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  moderator: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300",
  user: "bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
};

export function Avatar({ name, size = "h-9 w-9" }: { name: string; size?: string }) {
  // A steady colour per name, so people are easy to tell apart in lists.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase text-white`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))` }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_BADGE[role]}`}>{ROLE_LABELS[role]}</span>;
}

export default function UsersAdmin({ currentUser }: { currentUser: User }) {
  const dialog = useDialog();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listUsers().then(setUsers, (err) => setError(errorMessage(err)));
  }, []);

  const replace = (user: User) => setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, ...user } : u)) ?? null);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return (users ?? [])
      .filter((u) => (roleFilter === "all" || u.role === roleFilter) && (!q || u.username.toLocaleLowerCase("tr").includes(q)))
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
  }, [users, search, roleFilter]);

  async function handlePlan(user: User, plan: PlanId) {
    try {
      await api.setUserPlan(user.id, plan);
      replace({ ...user, plan });
    } catch (err) {
      await dialog.alert({ title: "Paket değiştirilemedi", message: errorMessage(err), tone: "danger" });
    }
  }

  async function handleRole(user: User, role: Role) {
    const updated = await changeRole(dialog, user, role);
    if (updated) replace(updated);
  }

  const identity = (u: User) => (
    <>
      <p className="truncate font-semibold">
        {u.username}
        {u.id === currentUser.id ? <span className="ml-1.5 text-xs font-normal text-slate-400">(siz)</span> : null}
      </p>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatDate(u.createdAt)} tarihinde katıldı</p>
    </>
  );

  const selectClass = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  const roleControl = (u: User) =>
    u.id === currentUser.id ? (
      <RoleBadge role={u.role} />
    ) : (
      <select value={u.role} onChange={(e) => void handleRole(u, e.target.value as Role)} aria-label={`${u.username} rolü`} className={selectClass}>
        {(["user", "moderator", "admin"] as const).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    );

  const planControl = (u: User) => (
    <select value={u.plan} onChange={(e) => void handlePlan(u, e.target.value as PlanId)} aria-label={`${u.username} paketi`} className={selectClass}>
      {PLANS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );

  const actions = (u: User) => (
    <div className="flex shrink-0 justify-end gap-1">
      <button type="button" onClick={() => void resetPassword(dialog, u)} title="Şifreyi değiştir" aria-label={`${u.username} şifresini değiştir`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
        <KeyRound size={16} />
      </button>
      {u.id !== currentUser.id ? (
        <button
          type="button"
          onClick={async () => (await deleteAccount(dialog, u)) && setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? null)}
          title="Kullanıcıyı sil"
          aria-label={`${u.username} kullanıcısını sil`}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  );

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  const counts = { all: users?.length ?? 0, admin: 0, moderator: 0, user: 0 };
  for (const u of users ?? []) counts[u.role]++;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/70">
          {(["all", "user", "moderator", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                roleFilter === r ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              {r === "all" ? "Tümü" : ROLE_LABELS[r]} <span className="ml-1 text-xs opacity-60">{counts[r]}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kullanıcı ara…" aria-label="Kullanıcı ara" className="input w-full !pl-9" />
        </label>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <UserPlus size={16} />
          Kullanıcı ekle
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {users == null ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Eşleşen kullanıcı yok.</p>
        ) : (
          <>
            {/* Phone: one card per account (a table squeezed into a row overlaps on Safari). */}
            <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {visible.map((u) => (
                <li key={u.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.username} />
                    <div className="min-w-0 flex-1">{identity(u)}</div>
                    {actions(u)}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-12 text-xs text-slate-500 dark:text-slate-400">
                    {roleControl(u)}
                    {planControl(u)}
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{u.ownedVehicles ?? 0} araç</span>
                    <span title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString("tr-TR") : undefined}>
                      Son giriş: {u.lastSeenAt ? formatRelative(u.lastSeenAt) : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Kullanıcı</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Paket</th>
                  <th className="px-3 py-3">Araç</th>
                  <th className="px-3 py-3">Son giriş</th>
                  <th className="px-5 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={u.username} />
                        <div className="min-w-0">{identity(u)}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{roleControl(u)}</td>
                    <td className="px-3 py-3">{planControl(u)}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300" title={`Paket sınırı ${planById(u.plan).maxVehicles}`}>
                      {u.ownedVehicles ?? 0}
                      <span className="text-slate-400"> araç</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400" title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString("tr-TR") : undefined}>
                      {u.lastSeenAt ? formatRelative(u.lastSeenAt) : "—"}
                    </td>
                    <td className="px-5 py-3">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {creating ? (
        <NewUserModal
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

export function NewUserModal({ onClose, onCreated, initialRole = "user" }: { onClose: () => void; onCreated: (user: User) => void; initialRole?: Role }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal title={initialRole === "moderator" ? "Yeni moderatör" : "Yeni kullanıcı"} onClose={onClose} width="max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          try {
            onCreated(await api.createUser(username.trim(), password, role));
          } catch (err) {
            setError(errorMessage(err));
            setSubmitting(false);
          }
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Kullanıcı adı</span>
          <input autoComplete="off" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} className="input" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Şifre</span>
          <input type="password" autoComplete="new-password" placeholder="En az 8 karakter" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required minLength={8} />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium text-slate-600 dark:text-slate-300">Rol</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["user", "moderator", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                  role === r ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {role === "admin" ? "Her şeye erişir: kullanıcılar, roller, katalog." : role === "moderator" ? "Canlı desteği yanıtlar ve hata kayıtlarını görür." : "Uygulamayı normal şekilde kullanır."}
          </p>
        </fieldset>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button type="submit" disabled={submitting} className="mt-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {submitting ? "Ekleniyor…" : "Oluştur"}
        </button>
      </form>
    </Modal>
  );
}
