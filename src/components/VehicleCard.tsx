import { AlertTriangle, Car, ChevronRight, Clock, Users } from "lucide-react";
import { FUEL_TYPE_LABELS, formatDate, formatNumber, formatTL, vehicleSubtitle } from "../lib/format";
import { paths, VEHICLE_TAB_LABELS, type VehicleTab } from "../lib/router";
import type { Vehicle, VehicleStats } from "../types";

interface Props {
  vehicle: Vehicle;
  stats: VehicleStats;
  /** Counts of overdue / due-soon reminders, if any. */
  alerts?: { overdue: number; soon: number };
}

const QUICK_TABS: VehicleTab[] = ["dolumlar", "masraflar", "hatirlatmalar"];

export default function VehicleCard({ vehicle, stats, alerts }: Props) {
  const subtitle = vehicleSubtitle(vehicle);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500">
      <a href={paths.vehicle(vehicle.id)} className="group flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
              <Car size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{vehicle.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle ?? FUEL_TYPE_LABELS[vehicle.fuelType]}
              </p>
            </div>
          </div>
          {vehicle.plate ? (
            <span className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {vehicle.plate}
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Bu ay" value={formatTL(stats.thisMonthCost + stats.thisMonthOtherCost)} />
          <Metric
            label="Ort. tüketim"
            value={
              stats.avgConsumptionPer100km != null
                ? `${formatNumber(stats.avgConsumptionPer100km, 1)} L`
                : "—"
            }
          />
          <Metric
            label="Son km"
            value={stats.latestOdometerKm != null ? formatNumber(stats.latestOdometerKm, 0) : "—"}
          />
        </dl>

        {vehicle.myRole === "helper" ? (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Users size={12} />
            Sahibi: {vehicle.ownerName ?? "—"}
          </p>
        ) : null}

        {alerts ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {alerts.overdue > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle size={12} />
                {alerts.overdue} gecikmiş hatırlatma
              </span>
            ) : null}
            {alerts.soon > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Clock size={12} />
                {alerts.soon} yaklaşan hatırlatma
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>
            {stats.lastFillDate ? `Son dolum: ${formatDate(stats.lastFillDate)}` : "Henüz dolum yok"}
          </span>
          <ChevronRight
            size={16}
            className="transition group-hover:translate-x-0.5 group-hover:text-brand-500"
          />
        </p>
      </a>

      <nav className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
        {QUICK_TABS.map((tab) => (
          <a
            key={tab}
            href={paths.vehicle(vehicle.id, tab)}
            className="px-2 py-2 text-center font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-brand-300"
          >
            {VEHICLE_TAB_LABELS[tab]}
          </a>
        ))}
      </nav>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
