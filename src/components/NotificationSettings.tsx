import { useEffect, useState } from "react";
import { BellOff, BellRing, Share, SquarePlus } from "lucide-react";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "../lib/push";
import { errorMessage } from "../lib/api";
import { toast } from "./Toaster";

/** Turns reminder notifications on or off for this device, with iPhone install guidance. */
export default function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState, () => setState("unsupported"));
  }, []);

  async function run(action: () => Promise<PushState | void>, done?: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) setState(next);
      if (done) toast(done);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (state == null || state === "unsupported") return null;

  const button =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            state === "on"
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              : "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"
          }`}
        >
          {state === "on" ? <BellRing size={18} /> : <BellOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Bildirimler</p>
          {state === "on" ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Açık. Tarih 7, 3 ve 1 gün kala, son gün ve gecikince; km sınırına 500 km kala haber verilir.
            </p>
          ) : state === "off" ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Muayene, sigorta gibi hatırlatmalar yaklaşınca bu cihaza bildirim gelsin.
            </p>
          ) : state === "denied" ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Bildirim izni kapalı. Açmak için cihaz ayarlarından CarLog'a bildirim izni verin.
            </p>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <p>iPhone'da bildirimler için CarLog'u ana ekrana ekleyin:</p>
              <ol className="mt-1.5 flex flex-col gap-1">
                <li className="flex items-center gap-1.5">
                  <span>1. Safari'de</span>
                  <Share size={14} />
                  <span>
                    <b>Paylaş</b>'a dokunun
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>2.</span>
                  <SquarePlus size={14} />
                  <span>
                    <b>Ana Ekrana Ekle</b>'yi seçin
                  </span>
                </li>
                <li>3. CarLog'u ana ekrandan açıp buradan bildirimleri açın</li>
              </ol>
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          {state === "off" || state === "on" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {state === "off" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(enablePush, "Bildirimler açıldı")}
                  className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
                >
                  Bildirimleri aç
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(async () => void (await sendTestPush()), "Deneme bildirimi gönderildi")}
                    className={`${button} bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200`}
                  >
                    Deneme bildirimi gönder
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(disablePush, "Bildirimler kapatıldı")}
                    className={`${button} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
                  >
                    Kapat
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
