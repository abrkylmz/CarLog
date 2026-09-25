import { useState } from "react";
import { Upload } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { clearLegacyData, readLegacyData } from "../lib/legacy";

interface Props {
  /** Called after a successful import so the app can reload data from the server. */
  onImported: () => void;
}

/** Offers admins a one-time move of data saved in this browser before the server existed. */
export default function LegacyImportBanner({ onImported }: Props) {
  const [legacy, setLegacy] = useState(() => readLegacyData());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!legacy) return null;

  async function handleImport() {
    if (!legacy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.importLegacy(legacy);
      clearLegacyData();
      setLegacy(null);
      window.alert(`${result.vehicles} araç ve ${result.entries} dolum kaydı sunucuya aktarıldı.`);
      onImported();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function handleDismiss() {
    if (!window.confirm("Bu tarayıcıdaki eski kayıtlar kalıcı olarak silinecek. Emin misiniz?")) return;
    clearLegacyData();
    setLegacy(null);
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700/60 dark:bg-amber-950/40">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        Bu tarayıcıda sunucuya aktarılmamış eski kayıtlar var
      </p>
      <p className="mt-1 text-amber-800 dark:text-amber-300/80">
        {legacy.vehicles.length} araç ve {legacy.entries.length} dolum kaydı. Aktarınca tüm kullanıcılar
        görebilir; dolumlar sizin adınıza eklenir.
      </p>
      {error ? <p className="mt-2 text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          <Upload size={14} />
          {busy ? "Aktarılıyor…" : "Sunucuya Aktar"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 font-medium text-amber-800 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Aktarma, sil
        </button>
      </div>
    </div>
  );
}
