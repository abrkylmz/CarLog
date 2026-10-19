import { ArrowDownRight, ArrowUpRight, Bell, CalendarCheck, ChevronRight, Fuel, MapPin, Target } from "lucide-react";
import { formatTL } from "../lib/format";
import { priceKind, useFuelPrices } from "../lib/fuelPrices";
import { paths } from "../lib/router";
import { useSession } from "../lib/session";
import type { FuelType } from "../types";

const tl = (n: number) => formatTL(n).replace(",00", "");
const perLitre = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FUEL_NAMES = { benzin: "Benzin", motorin: "Motorin", lpg: "LPG" } as const;

export interface NextTask {
  title: string;
  vehicleName: string;
  vehicleId: string;
  /** "16 gün kaldı", "3 gün gecikti"… */
  when: string;
  overdue: boolean;
}

interface Props {
  spent: number;
  budget: number | null;
  onEditBudget: () => void;
  task: NextTask | null;
  /** Where to add a first reminder when there is none. */
  firstVehicleId: string | null;
  /** The fuel of most of the user's vehicles: whose price is shown. */
  fuel: FuelType | null;
}

/**
 * The three things worth a look every day, before scrolling: this month against the budget, the
 * most urgent reminder, and today's pump price in the user's city. Each opens where it's handled.
 */
export default function TodayStrip({ spent, budget, onEditBudget, task, firstVehicleId, fuel }: Props) {
  const session = useSession();
  const prices = useFuelPrices(session?.user);
  const now = new Date();
  const monthName = now.toLocaleDateString("tr-TR", { month: "long" });
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const kind = fuel ? priceKind(fuel) : "benzin";
  const city = prices.current;
  const price = city?.[kind] ?? null;
  const before = city?.previous?.[kind] ?? null;
  const recent = city?.changedAt && Date.now() - Date.parse(city.changedAt) < 14 * 86_400_000;
  const diff = recent && price != null && before != null ? Math.round((price - before) * 100) / 100 : 0;

  const row = "group flex min-w-0 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-1 sm:py-4 dark:hover:bg-white/[0.03]";
  const icon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl";
  const label = "text-xs font-medium text-slate-500 dark:text-slate-400";
  const value = "truncate font-semibold tabular-nums tracking-tight";

  return (
    <section aria-label="Bugün" className="card overflow-hidden">
      <p className="flex items-baseline justify-between px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Bugün
        <span className="font-medium normal-case tracking-normal">{now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</span>
      </p>
      <div className="flex flex-col divide-y divide-slate-100 sm:flex-row sm:divide-x sm:divide-y-0 dark:divide-white/[0.06]">
        {/* Budget */}
        {budget ? (
          <button type="button" onClick={onEditBudget} className={row} aria-label={`${monthName} bütçesinin yüzde ${Math.round((spent / budget) * 100)}'i harcandı; bütçeyi düzenle`}>
            <Ring used={spent / budget} />
            <span className="min-w-0 flex-1">
              <span className={`${label} block`}>
                <span className="capitalize">{monthName}</span> bütçesi {tl(budget)}
              </span>
              <span className={`${value} block`}>{tl(spent)} harcandı</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{daysLeft} gün kaldı · kalan {tl(Math.max(0, budget - spent))}</span>
            </span>
          </button>
        ) : (
          <button type="button" onClick={onEditBudget} className={row}>
            <span className={`${icon} bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400`}>
              <Target size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`${label} block`}>Bu ay {tl(spent)}</span>
              <span className={`${value} block text-brand-600 dark:text-brand-300`}>Aylık bütçe belirle</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Harcamanı bir hedefle karşılaştır</span>
            </span>
          </button>
        )}

        {/* Most urgent reminder */}
        {task ? (
          <a href={paths.vehicle(task.vehicleId, "hatirlatmalar")} className={row}>
            <span className={`${icon} ${task.overdue ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"}`}>
              <Bell size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`${label} block truncate`}>{task.overdue ? "Gecikmiş iş" : "Sıradaki iş"} · {task.vehicleName}</span>
              <span className={`${value} block`}>{task.title}</span>
              <span className={`block text-xs font-semibold ${task.overdue ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>{task.when}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
          </a>
        ) : (
          <a href={firstVehicleId ? paths.vehicle(firstVehicleId, "hatirlatmalar") : paths.newVehicle} className={row}>
            <span className={`${icon} bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400`}>
              <CalendarCheck size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`${label} block`}>Sıradaki iş</span>
              <span className={`${value} block`}>Yaklaşan iş yok</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Muayene ve sigorta tarihini ekle</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
          </a>
        )}

        {/* Pump price */}
        <a href="#akaryakit" onClick={scrollToPrices} className={row}>
          <span className={`${icon} bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300`}>
            {city ? <Fuel size={20} /> : <MapPin size={20} />}
          </span>
          {city && price != null ? (
            <span className="min-w-0 flex-1">
              <span className={`${label} block truncate`}>
                {FUEL_NAMES[kind]} · {city.name}
              </span>
              <span className={`${value} block`}>
                {perLitre(price)}
                <span className="ml-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">/L</span>
              </span>
              {diff ? (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${diff > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {diff > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {perLitre(Math.abs(diff))} {diff > 0 ? "zam" : "indirim"}
                </span>
              ) : (
                <span className="block text-xs text-slate-500 dark:text-slate-400">Pompa fiyatı, KDV dahil</span>
              )}
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className={`${label} block`}>Yakıt fiyatı</span>
              <span className={`${value} block`}>Şehrini seç</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Güncel benzin, motorin, LPG</span>
            </span>
          )}
          <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
        </a>
      </div>
    </section>
  );
}

/** Smooth scroll to the price card instead of changing the route (the app routes by hash). */
function scrollToPrices(e: React.MouseEvent) {
  e.preventDefault();
  document.getElementById("akaryakit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Ring({ used }: { used: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const tone = used >= 1 ? "text-red-500" : used >= 0.85 ? "text-amber-500" : "text-brand-500";
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, used))}
          className={`${tone} transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none`}
        />
      </svg>
      <span className="text-[10px] font-bold tabular-nums">%{Math.round(used * 100)}</span>
    </span>
  );
}
