import { useRef, useState } from "react";
import { Crown, Loader2, ScanLine } from "lucide-react";
import { api, errorMessage, type ReceiptReading } from "../lib/api";
import { compressImage } from "../lib/image";
import { userHasFeature } from "../lib/plans";
import { paths } from "../lib/router";
import { useSession } from "../lib/session";
import { useDialog } from "./DialogProvider";

const CONSENT_KEY = "carlog:receipt-consent";

/**
 * "Fiş Tara": photograph a fuel receipt and fill the form from it. Hidden when the server has no
 * key for it; locked (with a link to the plans) on plans without the feature. The first use asks
 * for consent, since the photo goes abroad to be read (KVKK m.9).
 */
export default function ReceiptScanButton({ onRead, className = "" }: { onRead: (reading: ReceiptReading) => void; className?: string }) {
  const session = useSession();
  const dialog = useDialog();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.services.receiptScan) return null;
  if (!userHasFeature(session.user, "receiptScan")) {
    return (
      <a href={paths.plans} className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-800 dark:text-amber-300 ${className}`}>
        <ScanLine size={16} />
        Fiş Tara
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold dark:bg-amber-950">
          <Crown size={10} />
          Pro
        </span>
      </a>
    );
  }

  async function start() {
    let consented = false;
    try {
      consented = localStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      // Storage blocked: ask every time.
    }
    if (!consented) {
      const ok = await dialog.confirm({
        title: "Fiş fotoğrafı nasıl okunur?",
        message:
          "Fotoğraf, okunması için yapay zekâ servisine (Anthropic, ABD) gönderilir; yalnızca tutar, litre, fiyat, tarih ve istasyon çıkarılır ve fotoğraf saklanmaz. Devam ederseniz bu aktarıma onay vermiş olursunuz.",
        confirmLabel: "Onaylıyorum",
      });
      if (!ok) return;
      try {
        localStorage.setItem(CONSENT_KEY, "1");
      } catch {
        // Not remembered; fine.
      }
    }
    input.current?.click();
  }

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-70 dark:bg-white dark:text-slate-900"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
        {busy ? "Fiş okunuyor…" : "Fiş Tara"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            onRead(await api.scanReceipt(await compressImage(file, 1600)));
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  );
}
