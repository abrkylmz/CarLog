import { Route } from "lucide-react";
import { formatMonth, formatNumber } from "../lib/format";
import { CountUp } from "./StatCard";

/** "Ocak 2026 — 1.240 km": km driven per month as bars, oldest first (last 12 months with data). */
export default function MonthlyKmCard({ km }: { km: Map<string, number> }) {
  const months = [...km].filter(([, value]) => value >= 1).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  if (months.length === 0) return null;
  const max = Math.max(...months.map(([, value]) => value));
  const total = months.reduce((t, [, value]) => t + value, 0);
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Route size={15} className="text-brand-500" />
          Aylık Kilometre
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Toplam <b className="tabular-nums text-slate-700 dark:text-slate-200">{formatNumber(total, 0)} km</b> · aylık ortalama{" "}
          <b className="tabular-nums text-slate-700 dark:text-slate-200">{formatNumber(total / months.length, 0)} km</b>
        </p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {months.map(([month, value], i) => (
          <li key={month} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              <span className="capitalize">{formatMonth(month)}</span>
              {month === currentMonth ? <span className="block text-[10px] text-slate-400 dark:text-slate-500">devam ediyor</span> : null}
            </span>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="grow-x h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(2, (value / max) * 100)}%`, animationDelay: `${i * 60}ms` }}
              />
            </div>
            <span className="w-20 text-right font-semibold tabular-nums">
              <CountUp to={value} format={(n) => `${formatNumber(n, 0)} km`} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        İki kilometre kaydı arasındaki yol, aradaki günlere eşit dağıtılarak aylara bölünür.
      </p>
    </section>
  );
}
