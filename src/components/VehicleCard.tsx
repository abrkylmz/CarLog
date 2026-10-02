import { AlertTriangle, Clock, Fuel, MoreVertical, Route, Users, Wallet, Zap } from "lucide-react";
import { formatConsumption, FUEL_TYPE_LABELS, formatNumber, formatTL } from "../lib/format";
import { usePopover } from "../lib/popover";
import { paths, VEHICLE_TAB_LABELS, type VehicleTab } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { Vehicle, VehicleStats } from "../types";
import CarArt from "./CarArt";
import { openQuickAdd } from "./QuickAdd";

interface Props {
  vehicle: Vehicle;
  stats: VehicleStats;
  /** Counts of overdue / due-soon reminders, if any. */
  alerts?: { overdue: number; soon: number };
  /** Spend for each of the last 12 months, oldest first. */
  spend: number[];
}

const MENU_TABS: VehicleTab[] = ["dolumlar", "masraflar", "hatirlatmalar", "aylik", "bilgiler"];

/** A vehicle on the dashboard: drawing, key figures, a year of spend and the two main actions. */
export default function VehicleCard({ vehicle, stats, alerts, spend }: Props) {
  const details = [vehicle.plate, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(" · ");
  const makeModel = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const FuelIcon = vehicle.fuelType === "hibrit" ? Zap : Fuel;

  return (
    <article
      data-accent={FUEL_ACCENT[vehicle.fuelType]}
      className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <CardMenu vehicleId={vehicle.id} />

      <a href={paths.vehicle(vehicle.id)} className="block" aria-label={`${vehicle.name} detayları`}>
        <div className="relative -mx-4 -mt-4 mb-3 flex h-32 items-end justify-center overflow-hidden bg-gradient-to-b from-brand-50 to-white px-6 pb-1 dark:from-brand-900/30 dark:to-slate-900">
          <div aria-hidden className="absolute -top-10 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-brand-200/50 blur-2xl dark:bg-brand-700/20" />
          <CarArt className="relative h-24 w-auto transition duration-500 group-hover/card:-translate-y-0.5 group-hover/card:scale-[1.03]" />
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight">{vehicle.name}</h3>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {details || makeModel || FUEL_TYPE_LABELS[vehicle.fuelType]}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <FuelIcon size={13} />
            {FUEL_TYPE_LABELS[vehicle.fuelType]}
          </span>
        </div>
      </a>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
        <Metric
          icon={Fuel}
          value={stats.avgConsumptionPer100km != null ? formatConsumption(stats.avgConsumptionPer100km, stats.consumptionKind) : "—"}
          label="L/100km"
        />
        <Metric icon={Route} value={stats.latestOdometerKm != null ? formatNumber(stats.latestOdometerKm, 0) : "—"} label="km" />
        <Metric
          icon={Wallet}
          value={formatTL(stats.thisMonthCost + stats.thisMonthOtherCost).replace(",00", "")}
          label="Bu ay"
        />
      </dl>

      {vehicle.myRole === "helper" || alerts ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {vehicle.myRole === "helper" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users size={12} />
              Sahibi: {vehicle.ownerName ?? "—"}
            </span>
          ) : null}
          {alerts && alerts.overdue > 0 ? (
            <a
              href={paths.vehicle(vehicle.id, "hatirlatmalar")}
              className="pulse-alert inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              <AlertTriangle size={12} />
              {alerts.overdue} gecikmiş hatırlatma
            </a>
          ) : null}
          {alerts && alerts.soon > 0 ? (
            <a
              href={paths.vehicle(vehicle.id, "hatirlatmalar")}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              <Clock size={12} />
              {alerts.soon} yaklaşan hatırlatma
            </a>
          ) : null}
        </div>
      ) : null}

      <Sparkline values={spend} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openQuickAdd("entry", vehicle.id)}
          className="rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-700"
        >
          Yakıt Ekle
        </button>
        <a
          href={paths.vehicle(vehicle.id)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Detaylar
        </a>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Fuel; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2 first:pl-0 last:pr-0">
      <Icon size={17} className="hidden shrink-0 text-slate-400 min-[400px]:block dark:text-slate-500" />
      <div className="min-w-0">
        <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
        <dt className="truncate text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      </div>
    </div>
  );
}

/** The last 12 months of spend: a soft area for the trend, bars for each month, this month strongest. */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 240;
  const h = 40;
  const step = w / values.length;
  const y = (v: number) => h - 2 - (v / max) * (h - 8);
  const points = values.map((v, i) => [i * step + step / 2, y(v)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const total = values.reduce((t, v) => t + v, 0);

  return (
    <div className="mt-4" title={`Son 12 ay: ${formatTL(total)}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
        <path d={`${line} L${points.at(-1)![0]} ${h} L${points[0][0]} ${h} Z`} className="fill-brand-500/10" />
        {values.map((v, i) => (
          <rect
            key={i}
            x={i * step + step * 0.3}
            width={step * 0.4}
            y={v > 0 ? y(v) : h - 2}
            height={v > 0 ? h - y(v) : 2}
            rx="1.5"
            className={i === values.length - 1 ? "fill-brand-500" : "fill-brand-300/70 dark:fill-brand-700/80"}
          />
        ))}
        <path d={line} fill="none" strokeWidth="1.5" strokeLinejoin="round" className="stroke-brand-500" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>Son 12 ay harcama</span>
        <span className="tabular-nums">{formatTL(total).replace(",00", "")}</span>
      </p>
    </div>
  );
}

function CardMenu({ vehicleId }: { vehicleId: string }) {
  const { open, toggle, ref } = usePopover();
  return (
    <div ref={ref} className="absolute right-2 top-2 z-10">
      <button
        type="button"
        onClick={toggle}
        aria-label="Araç menüsü"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <MoreVertical size={18} />
      </button>
      {open ? (
        <div className="pop-in absolute right-0 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {MENU_TABS.map((tab) => (
            <a
              key={tab}
              href={paths.vehicle(vehicleId, tab)}
              className="block px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {VEHICLE_TAB_LABELS[tab]}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
