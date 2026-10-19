import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Fuel, MapPin, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { formatRelative } from "../lib/format";
import { useSession } from "../lib/session";
import type { CityFuelPrice, FuelPrices, FuelType } from "../types";

const price = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A change is news for two weeks; after that only the price is shown. */
const RECENT_CHANGE_MS = 14 * 86_400_000;

const KINDS = [
  { key: "benzin", label: "Benzin", sub: "Kurşunsuz 95", fuels: ["benzin", "benzin-lpg", "hibrit"] },
  { key: "motorin", label: "Motorin", sub: "Dizel", fuels: ["dizel"] },
  { key: "lpg", label: "LPG", sub: "Otogaz", fuels: ["lpg", "benzin-lpg"] },
] as const;

/**
 * Today's pump prices (petrol, diesel, autogas) in the user's chosen city, with the latest rise or
 * cut. The city is kept on the account, so every device shows the same one.
 */
export default function FuelPricesCard({ fuelTypes }: { fuelTypes: FuelType[] }) {
  const session = useSession();
  const [data, setData] = useState<FuelPrices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(session?.user.fuelCity ?? null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError(null);
    api.fuelPrices().then(setData, (err) => setError(errorMessage(err)));
  };
  useEffect(load, []);

  async function choose(code: string) {
    const before = city;
    setCity(code || null);
    setSaving(true);
    try {
      await api.setFuelCity(code || null);
    } catch (err) {
      setCity(before);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const current: CityFuelPrice | undefined = data?.cities.find((c) => c.code === city);
  const recent = current?.changedAt && current.previous && Date.now() - Date.parse(current.changedAt) < RECENT_CHANGE_MS;
  const changeDay = current?.changedAt ? new Date(current.changedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";

  const picker = data?.cities.length ? (
    <label className="relative inline-flex items-center">
      <MapPin size={15} className="pointer-events-none absolute left-2.5 text-slate-400" />
      <select
        value={city ?? ""}
        onChange={(e) => void choose(e.target.value)}
        disabled={saving}
        aria-label="Şehir"
        className="max-w-[11rem] appearance-none truncate rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-sm font-medium text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {city ? null : <option value="">Şehir seç…</option>}
        {data.cities.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 text-xs text-slate-400">▾</span>
    </label>
  ) : null;

  return (
    <section aria-label="Akaryakıt fiyatları" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Fuel size={18} />
          </span>
          Akaryakıt fiyatları
        </h2>
        {picker}
      </div>

      {error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Fiyatlar şu an alınamadı.
          <button type="button" onClick={load} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
            <RefreshCw size={14} /> Tekrar dene
          </button>
        </p>
      ) : !data ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {KINDS.map((k) => (
            <div key={k.key} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : !data.cities.length ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Fiyatlar henüz alınamadı; biraz sonra tekrar bakın.</p>
      ) : !current ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Şehrini seç; benzin, motorin ve LPG'nin güncel pompa fiyatını burada gör.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {KINDS.map((k) => {
              const now = current[k.key];
              const before = current.previous?.[k.key] ?? null;
              const diff = recent && now != null && before != null ? Math.round((now - before) * 100) / 100 : 0;
              const mine = fuelTypes.some((f) => (k.fuels as readonly string[]).includes(f));
              return (
                <div
                  key={k.key}
                  className={`rounded-xl px-3 py-2.5 ${mine ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:ring-brand-800" : "bg-slate-50 dark:bg-slate-800/60"}`}
                >
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{k.label}</p>
                  <p className="text-[11px] text-slate-400">{k.sub}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-xl">{now != null ? price(now) : "—"}</p>
                  {diff ? (
                    <p className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold ${diff > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {diff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {price(Math.abs(diff))} · {changeDay}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            {data.source} pompa fiyatları, litre başına, KDV dahil. İstasyona göre küçük farklar olabilir.
            {data.fetchedAt ? ` Güncelleme: ${formatRelative(data.fetchedAt)}.` : ""}
          </p>
        </>
      )}
    </section>
  );
}
