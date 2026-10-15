import { useState } from "react";
import { Fuel, KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { api, errorMessage, type AdminSetupState } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";
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
        askEmail={isRegister}
        askPrivacy={isRegister}
        submitLabel={isRegister ? "Hesap Oluştur" : "Giriş Yap"}
        submitIcon={isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
        onSubmit={async ({ username, password, email, acceptedPrivacy }) =>
          (isRegister ? await api.register(username, password, email, acceptedPrivacy) : await api.login(username, password, "user")).user
        }
        onAuthenticated={onAuthenticated}
      />
      {!isRegister ? <ForgotPassword /> : null}

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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))]" />
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
  email: string;
  acceptedPrivacy: boolean;
}

function CredentialsForm({
  confirmPassword = false,
  askSetupKey = false,
  askEmail = false,
  askPrivacy = false,
  submitLabel,
  submitIcon,
  onSubmit,
  onAuthenticated,
}: {
  confirmPassword?: boolean;
  askSetupKey?: boolean;
  askEmail?: boolean;
  askPrivacy?: boolean;
  submitLabel: string;
  submitIcon: React.ReactNode;
  onSubmit: (credentials: Credentials) => Promise<User>;
  onAuthenticated: (user: User) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmPassword && password !== passwordConfirm) return setError("Şifreler eşleşmiyor.");
    if (askPrivacy && !acceptedPrivacy) return setError("Devam etmek için aydınlatma metnini onaylayın.");

    setError(null);
    setSubmitting(true);
    try {
      onAuthenticated(await onSubmit({ username: username.trim(), password, setupKey, email: email.trim(), acceptedPrivacy }));
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
          placeholder={confirmPassword ? "En az 8 karakter" : undefined}
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

      {askEmail ? (
        <Field label="E-posta (opsiyonel, şifrenizi unutursanız sıfırlamak için)">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
      ) : null}

      {askPrivacy ? (
        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span>
            <a href={paths.privacy} target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline dark:text-brand-300">
              KVKK Aydınlatma Metni
            </a>
            'ni okudum; verilerimin bu metinde anlatıldığı şekilde işlenmesini kabul ediyorum.
          </span>
        </label>
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

/** "Şifremi unuttum": asks for the username or email and sends a reset link if there's an address. */
function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-brand-600 hover:underline dark:text-slate-400">
        Şifremi unuttum
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        setError(null);
        try {
          setMessage((await api.forgotPassword(login.trim())).message);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setSending(false);
        }
      }}
      className="mt-4 flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"
    >
      {message ? (
        <p className="text-slate-700 dark:text-slate-200">{message}</p>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">Kullanıcı adınız veya e-postanız</span>
            <input value={login} onChange={(e) => setLogin(e.target.value)} className="input" required autoCapitalize="none" />
          </label>
          {error ? <p className="text-red-600 dark:text-red-400">{error}</p> : null}
          <button type="submit" disabled={sending} className="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900">
            {sending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hesabınızda e-posta yoksa şifrenizi yöneticiye sıfırlatabilirsiniz.</p>
        </>
      )}
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
