import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { navigate, paths } from "../lib/router";

/** Opened from the reset email: choose a new password; then sign in with it. */
export default function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    if (password !== repeat) return setError("Şifreler birbirini tutmuyor.");
    setError(null);
    setSaving(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <KeyRound size={20} className="text-brand-600" />
          Yeni şifre belirle
        </h1>
        {done ? (
          <>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Şifreniz değiştirildi. Tüm cihazlardaki oturumlarınız kapatıldı.</p>
            <button
              type="button"
              onClick={() => navigate(paths.home)}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Giriş yap
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">Yeni şifre (en az 8 karakter)</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">Yeni şifre (tekrar)</span>
              <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className="input" required />
            </label>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? "Kaydediliyor…" : "Şifreyi Kaydet"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
