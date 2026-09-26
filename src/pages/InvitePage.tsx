import { useEffect, useState } from "react";
import { Car, CheckCircle2, Users } from "lucide-react";
import BackLink from "../components/BackLink";
import { api, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { navigate, paths } from "../lib/router";
import type { InvitePreview } from "../types";

function useInvitePreview(token: string) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .invitePreview(token)
      .then(setPreview)
      .catch((err) => setError(errorMessage(err)));
  }, [token]);
  return { preview, error };
}

function inviteSentence(p: InvitePreview) {
  return (
    <>
      <b>{p.ownerName ?? "Araç sahibi"}</b>, sizi <b>{p.vehicleName}</b>
      {p.plate ? ` (${p.plate})` : ""} aracının kayıtlarına <b>yardımcı</b> olarak davet ediyor.
    </>
  );
}

/** Shown above the login/register form when a signed-out visitor opens an invite link. */
export function InviteNotice({ token }: { token: string }) {
  const { preview, error } = useInvitePreview(token);
  if (error) {
    return (
      <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
        {error}
      </p>
    );
  }
  if (!preview) return null;
  return (
    <div className="mb-4 flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-slate-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-slate-200">
      <Users size={18} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" />
      <p>
        {inviteSentence(preview)} Katılmak için giriş yapın; hesabınız yoksa <b>Hesap Oluştur</b> sekmesinden birkaç
        saniyede açabilirsiniz.
      </p>
    </div>
  );
}

/** Signed-in view of an invite link: confirm, then open the vehicle. */
export default function InvitePage({ token, onAccepted }: { token: string; onAccepted: (vehicleId: string) => Promise<void> }) {
  const { preview, error } = useInvitePreview(token);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  async function accept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const { vehicleId } = await api.acceptInvite(token);
      await onAccepted(vehicleId);
    } catch (err) {
      setAcceptError(errorMessage(err));
      setAccepting(false);
    }
  }

  return (
    <>
      <BackLink />
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Car size={28} />
        </div>
        {error ? (
          <>
            <h2 className="text-lg font-semibold">Davet kullanılamıyor</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Araç sahibinden yeni bir link isteyin.</p>
          </>
        ) : !preview ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Araç daveti</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{inviteSentence(preview)}</p>
            <ul className="mx-auto mt-4 max-w-xs text-left text-sm text-slate-600 dark:text-slate-300">
              {["Aracın kayıtlarını görebilirsiniz", "Dolum, masraf ve hatırlatma ekleyebilirsiniz", "Kendi girdiklerinizi düzenleyebilirsiniz"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2 py-0.5">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {t}
                  </li>
                ),
              )}
            </ul>
            {acceptError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{acceptError}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => navigate(paths.home)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={accepting}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {accepting ? "Katılınıyor…" : "Daveti Kabul Et"}
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Link {formatDate(preview.expiresAt.slice(0, 10))} tarihine kadar geçerli.
            </p>
          </>
        )}
      </div>
    </>
  );
}
