import { Check, Fuel } from "lucide-react";
import type { FuelEntry } from "../types";
import { openQuickAdd } from "./QuickAdd";

/**
 * Shown on a vehicle's summary until its consumption can be worked out: what's done, what's next,
 * and a shortcut to the next fill-up. Consumption needs two full fill-ups with an odometer reading.
 */
export default function FirstStepsCard({ vehicleId, entries }: { vehicleId: string; entries: FuelEntry[] }) {
  const measuring = entries.filter((e) => e.isFull === true && e.odometerKm != null).length;
  const steps = [
    { label: "Aracı ekle", done: true },
    { label: "İlk dolumu “Depo fullendi” ve kilometresiyle kaydet", done: measuring >= 1 },
    { label: "Bir sonraki full dolumda L/100km hesaplanır", done: measuring >= 2 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const left = Math.max(1, 2 - measuring);
  const current = steps.findIndex((s) => !s.done);

  return (
    <section className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5 dark:border-brand-900 dark:bg-brand-900/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold tracking-tight">Tüketimini görmeye {left} full dolum kaldı</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            İki full dolum arasındaki yakıt ve kilometreden gerçek L/100km'in hesaplanır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openQuickAdd("entry", vehicleId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Fuel size={16} />
          Yakıt Ekle
        </button>
      </div>
      <ol className="mt-4 flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.done
                  ? "bg-emerald-500 text-white"
                  : i === current
                    ? "bg-brand-600 text-white"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={s.done ? "text-slate-500 line-through decoration-slate-300 dark:text-slate-400" : i === current ? "font-semibold" : ""}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800" role="img" aria-label={`${steps.length} adımın ${doneCount}'i tamam`}>
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
    </section>
  );
}
