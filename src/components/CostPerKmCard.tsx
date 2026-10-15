import { Gauge } from "lucide-react";
import { monthKey, monthlyKm } from "../lib/calc";
import { formatNumber } from "../lib/format";
import type { Expense, FuelEntry } from "../types";

/** Fewer km than this over the year gives a per-km figure too noisy to show. */
const MIN_KM = 300;

/**
 * What a kilometre costs: fuel and every other expense over the last 12 months, divided by the km
 * driven in those months (from the odometer readings, spread over the days between them).
 */
export default function CostPerKmCard({ entries, expenses }: { entries: FuelEntry[]; expenses: Expense[] }) {
  const now = new Date();
  const months = new Set(
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }),
  );
  const km = [...monthlyKm(entries)].filter(([m]) => months.has(m)).reduce((t, [, v]) => t + v, 0);
  const fuel = entries.filter((e) => months.has(monthKey(e.date))).reduce((t, e) => t + e.totalCost, 0);
  const other = expenses.filter((x) => months.has(monthKey(x.date))).reduce((t, x) => t + x.amount, 0);

  const enough = km >= MIN_KM;
  const perKm = enough ? (fuel + other) / km : null;
  const tl = (n: number, digits = 2) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Gauge size={22} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Km başına maliyet</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
              {perKm != null ? (
                <>
                  {tl(perKm)} <span className="text-base font-semibold text-slate-500">/ km</span>
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {perKm != null
                ? `Son 12 ay · ${formatNumber(km, 0)} km · 1.000 km ≈ ${tl(perKm * 1000, 0)}`
                : `Hesaplamak için son 12 ayda en az ${MIN_KM} km'lik kilometre kaydı gerekiyor.`}
            </p>
          </div>
        </div>
        {perKm != null ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Yakıt</dt>
            <dd className="text-right font-semibold tabular-nums">{tl(fuel / km)} / km</dd>
            <dt className="text-slate-500 dark:text-slate-400">Diğer masraflar</dt>
            <dd className="text-right font-semibold tabular-nums">{tl(other / km)} / km</dd>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
