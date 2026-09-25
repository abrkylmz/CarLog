import { useState } from "react";
import { Fuel, LogIn, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { User } from "../types";

interface Props {
  /** "setup" creates the first admin account; "login" signs in an existing user. */
  mode: "setup" | "login";
  onAuthenticated: (user: User) => void;
}

export default function AuthPage({ mode, onAuthenticated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSetup = mode === "setup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSetup && password !== passwordConfirm) return setError("Şifreler eşleşmiyor.");

    setError(null);
    setSubmitting(true);
    try {
      const { user } = isSetup
        ? await api.setup(username.trim(), password)
        : await api.login(username.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-xl bg-brand-600 p-3 text-white">
            <Fuel size={28} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CarLog</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isSetup ? "İlk kurulum: admin hesabını oluşturun." : "Devam etmek için giriş yapın."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">Kullanıcı Adı</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
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
              autoComplete={isSetup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </label>

          {isSetup ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">Şifre (tekrar)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="input"
                required
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {isSetup ? <ShieldCheck size={16} /> : <LogIn size={16} />}
            {submitting ? "Lütfen bekleyin…" : isSetup ? "Admin Hesabını Oluştur" : "Giriş Yap"}
          </button>
        </form>

        {isSetup ? (
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Diğer kullanıcıları giriş yaptıktan sonra "Kullanıcılar" sayfasından ekleyebilirsiniz.
          </p>
        ) : null}
      </div>
    </div>
  );
}
