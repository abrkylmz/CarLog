import { BarChart3, CalendarPlus, Fuel, Wrench, Zap } from "lucide-react";
import { paths } from "../lib/router";
import { openQuickAdd, type QuickAddKind } from "./QuickAdd";

const TILE = "flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 text-xs font-semibold ring-1 transition hover:-translate-y-0.5 hover:shadow-md";
const TONES = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-900",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950",
  amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-950",
  violet: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-950",
};

const ADD: { kind: QuickAddKind; label: string; icon: typeof Fuel; tone: keyof typeof TONES }[] = [
  { kind: "entry", label: "Yakıt Ekle", icon: Fuel, tone: "brand" },
  { kind: "expense", label: "Masraf Ekle", icon: Wrench, tone: "emerald" },
  { kind: "reminder", label: "Hatırlatma Ekle", icon: CalendarPlus, tone: "amber" },
];

/** One-tap shortcuts on a vehicle's summary: the add forms open in place, the report opens its tab. */
export default function QuickActions({ vehicleId, className = "" }: { vehicleId: string; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Zap size={18} className="text-brand-500" />
        Hızlı İşlemler
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {ADD.map((a) => (
          <button key={a.kind} type="button" onClick={() => openQuickAdd(a.kind, vehicleId)} className={`${TILE} ${TONES[a.tone]}`}>
            <a.icon size={22} />
            <span className="text-center leading-tight">{a.label}</span>
          </button>
        ))}
        <a href={paths.vehicle(vehicleId, "aylik")} className={`${TILE} ${TONES.violet}`}>
          <BarChart3 size={22} />
          <span className="text-center leading-tight">Rapor Gör</span>
        </a>
      </div>
    </section>
  );
}
