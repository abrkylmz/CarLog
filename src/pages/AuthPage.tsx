import { useState } from "react";
import { Fuel, KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { api, errorMessage, type AdminSetupState } from "../lib/api";
import { paths } from "../lib/router";
import type { User } from "../types";

interface UserAuthProps {
  onAuthenticated: (user: User) => void;
  /** Extra context above the form, e.g. which vehicle an invite link is for. */
  notice?: React.ReactNode;
}

/** Main-page panel for regular users: sign in or create an account. */
export function UserAuthPage({ onAuthenticated, notice }: UserAuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const isRegister = mode === "register";

  return (
    <AuthShell subtitle="Yakıt gideri takibi">
      {notice}
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === m
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {m === "login" ? "Giriş Yap" : "Hesap Oluştur"}
          </button>
        ))}
      </div>

      <CredentialsForm
        key={mode}
        confirmPassword={isRegister}
        submitLabel={isRegister ? "Hesap Oluştur" : "Giriş Yap"}
        submitIcon={isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
        onSubmit={async ({ username, password }) =>
          (isRegister ? await api.register(username, password) : await api.login(username, password, "user")).user
        }
        onAuthenticated={onAuthenticated}
      />

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <a href={paths.admin} className="hover:text-brand-600 hover:underline dark:hover:text-brand-300">
          Yönetici girişi
        </a>
      </p>
    </AuthShell>
  );
}

interface AdminAuthProps {
  adminSetup: AdminSetupState;
  onAuthenticated: (user: User) => void;
}

/** Separate admin panel login; also where the very first admin is created with the setup key. */
export function AdminAuthPage({ adminSetup, onAuthenticated }: AdminAuthProps) {
  return (
    <AuthShell subtitle="Yönetici Paneli" admin>
      {adminSetup === "done" ? (
        <CredentialsForm
          submitLabel="Yönetici Girişi"
          submitIcon={<ShieldCheck size={16} />}
          onSubmit={async ({ username, password }) => (await api.login(username, password, "admin")).user}
          onAuthenticated={onAuthenticated}
        />
      ) : adminSetup === "available" ? (
        <>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Henüz yönetici hesabı yok. Sunucuya tanımladığınız kurulum anahtarı ile ilk yönetici hesabını
            oluşturun.
          </p>
          <CredentialsForm
            confirmPassword
            askSetupKey
            submitLabel="Yönetici Hesabını Oluştur"
            submitIcon={<KeyRound size={16} />}
            onSubmit={async ({ username, password, setupKey }) =>
              (await api.setupAdmin(username, password, setupKey)).user
            }
            onAuthenticated={onAuthenticated}
          />
        </>
      ) : (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p>Henüz yönetici hesabı yok ve kurulum kapalı.</p>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            İlk yöneticiyi oluşturmak için Vercel projesinde <b>Settings → Environment Variables</b> altına{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ADMIN_SETUP_KEY</code> adında gizli bir
            değer ekleyip projeyi yeniden yayınlayın.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <a href={paths.home} className="hover:text-brand-600 hover:underline dark:hover:text-brand-300">
          ← Kullanıcı girişi
        </a>
      </p>
    </AuthShell>
  );
}

function AuthShell({ subtitle, admin, children }: { subtitle: string; admin?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className={`mb-3 rounded-xl p-3 text-white ${admin ? "bg-slate-800 dark:bg-slate-700" : "bg-brand-600"}`}>
            {admin ? <ShieldCheck size={28} /> : <Fuel size={28} />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CarLog</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}

interface Credentials {
  username: string;
  password: string;
  setupKey: string;
}

function CredentialsForm({
  confirmPassword = false,
  askSetupKey = false,
  submitLabel,
  submitIcon,
  onSubmit,
  onAuthenticated,
}: {
  confirmPassword?: boolean;
  askSetupKey?: boolean;
  submitLabel: string;
  submitIcon: React.ReactNode;
  onSubmit: (credentials: Credentials) => Promise<User>;
  onAuthenticated: (user: User) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmPassword && password !== passwordConfirm) return setError("Şifreler eşleşmiyor.");

    setError(null);
    setSubmitting(true);
    try {
      onAuthenticated(await onSubmit({ username: username.trim(), password, setupKey }));
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {askSetupKey ? (
        <Field label="Kurulum Anahtarı">
          <input
            type="password"
            autoComplete="off"
            value={setupKey}
            onChange={(e) => setSetupKey(e.target.value)}
            className="input"
            required
          />
        </Field>
      ) : null}

      <Field label="Kullanıcı Adı">
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
      </Field>

      <Field label="Şifre">
        <input
          type="password"
          autoComplete={confirmPassword ? "new-password" : "current-password"}
          placeholder={confirmPassword ? "En az 6 karakter" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          required
        />
      </Field>

      {confirmPassword ? (
        <Field label="Şifre (tekrar)">
          <input
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="input"
            required
          />
        </Field>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitIcon}
        {submitting ? "Lütfen bekleyin…" : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
