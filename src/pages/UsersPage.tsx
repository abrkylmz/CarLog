import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2, UserPlus, UserRound } from "lucide-react";
import BackLink from "../components/BackLink";
import { api, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Role, User } from "../types";

interface Props {
  currentUser: User;
}

export default function UsersPage({ currentUser }: Props) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  async function handleResetPassword(user: User) {
    const password = window.prompt(`"${user.username}" için yeni şifre (en az 6 karakter):`);
    if (password == null) return;
    try {
      await api.setUserPassword(user.id, password);
      window.alert("Şifre güncellendi. Kullanıcının tüm oturumları kapatıldı.");
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  async function handleDelete(user: User) {
    if (!window.confirm(`"${user.username}" silinecek. Eklediği dolum kayıtları silinmez. Emin misiniz?`)) return;
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  return (
    <>
      <BackLink />
      <h2 className="text-lg font-semibold">Yönetici Paneli</h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Kullanıcı hesaplarını yönetin. Kayıt olan herkes normal kullanıcı olarak eklenir; buradan yönetici
        hesabı da oluşturabilirsiniz.
      </p>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Kullanıcı</h3>
        <NewUserForm onCreated={(user) => setUsers((prev) => [...(prev ?? []), user])} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Hesaplar</h3>
        {loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : users == null ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                <div className="rounded-full bg-slate-100 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {user.role === "admin" ? <ShieldCheck size={16} /> : <UserRound size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.username}
                    {user.id === currentUser.id ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">(siz)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user.role === "admin" ? "Admin" : "Kullanıcı"} · {formatDate(user.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetPassword(user)}
                  title="Şifreyi değiştir"
                  aria-label={`${user.username} şifresini değiştir`}
                  className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <KeyRound size={16} />
                </button>
                {user.id !== currentUser.id ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    title="Kullanıcıyı sil"
                    aria-label={`${user.username} kullanıcısını sil`}
                    className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <span className="w-7" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NewUserForm({ onCreated }: { onCreated: (user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const user = await api.createUser(username.trim(), password, role);
      onCreated(user);
      setSuccess(`"${user.username}" eklendi.`);
      setUsername("");
      setPassword("");
      setRole("user");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Kullanıcı Adı</span>
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="mehmet"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Şifre</span>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="En az 6 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Yetki</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
          <option value="user">Kullanıcı (ekleyebilir, silemez)</option>
          <option value="admin">Admin (her şeyi yapabilir)</option>
        </select>
      </label>

      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <UserPlus size={16} />
          {submitting ? "Ekleniyor…" : "Kullanıcı Ekle"}
        </button>
      </div>
    </form>
  );
}
