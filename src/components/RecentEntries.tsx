import { useState } from "react";
import { ArrowRight, Fuel } from "lucide-react";
import { formatNumber, formatTL } from "../lib/format";
import { paths } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { FuelEntry, Vehicle } from "../types";
import PendingBadge from "./PendingBadge";

const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const dateLabel = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00`));

/**
 * The latest fill-ups across all vehicles; "Tümünü Gör" shows more of them. With `single` (one
 * vehicle's page) the vehicle column gives way to the price per liter and "Tümünü Gör" opens the
 * vehicle's fill-up list.
 */
export default function RecentEntries({ vehicles, entries, single = false }: { vehicles: Vehicle[]; entries: FuelEntry[]; single?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  // Newest first; on the same day, the higher odometer reading is the later fill-up.
  const latest = entries
    .filter((e) => byId.has(e.vehicleId))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.odometerKm ?? 0) - (a.odometerKm ?? 0))
    .slice(0, expanded ? 20 : 5);
  const more = entries.length > 5;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          {single ? <Fuel size={19} className="text-brand-500" /> : null}
          {single ? "Son Dolumlar" : "Son Yakıt Kayıtları"}
        </h2>
        {single && more ? (
          <a
            href={paths.vehicle(vehicles[0].id, "dolumlar")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
          >
            Tümünü Gör
            <ArrowRight size={15} />
          </a>
        ) : more ? (
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
          >
            {expanded ? "Daha az göster" : "Tümünü Gör"}
            <ArrowRight size={15} className={`transition ${expanded ? "-rotate-90" : ""}`} />
          </button>
        ) : null}
      </div>

      {latest.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
          <Fuel size={16} />
          {single ? "Henüz dolum kaydı yok." : "Bu yıl için dolum kaydı yok."}
        </p>
      ) : (
        <>
          {/* Phones: a compact list */}
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
            {latest.map((e) => {
              const v = byId.get(e.vehicleId)!;
              return (
                <li key={e.id}>
                  <a href={paths.vehicle(v.id, "dolumlar")} className="flex items-center gap-3 py-2.5">
                    <VehicleDot vehicle={v} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{single ? dateLabel(e.date) : v.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {single ? `${formatNumber(e.pricePerLiter, 2)} TL/L` : dateLabel(e.date)} · {formatNumber(e.liters, 1)} L
                        {e.odometerKm != null ? ` · ${formatNumber(e.odometerKm, 0)} km` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatTL(e.totalCost)}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Wider screens: a table */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">Tarih</th>
                <th className="py-2 pr-3 font-medium">{single ? "Depo" : "Araç"}</th>
                <th className="py-2 pr-3 text-right font-medium">Kilometre</th>
                <th className="py-2 pr-3 text-right font-medium">Litre</th>
                <th className="py-2 pr-3 text-right font-medium">Tutar</th>
                <th className="py-2 font-medium">Ekleyen</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((e) => {
                const v = byId.get(e.vehicleId)!;
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/70">
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      {dateLabel(e.date)} <PendingBadge id={e.id} />
                    </td>
                    <td className="max-w-[10rem] py-2.5 pr-3">
                      {single ? (
                        <span className="text-slate-500 dark:text-slate-400">
                          {e.isFull === true ? "Full" : e.isFull === false ? "Kısmi" : "—"} · {formatNumber(e.pricePerLiter, 2)} TL/L
                        </span>
                      ) : (
                      <a href={paths.vehicle(v.id, "dolumlar")} className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-300">
                        <VehicleDot vehicle={v} />
                        <span className="truncate">{v.name}</span>
                      </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                      {e.odometerKm != null ? formatNumber(e.odometerKm, 0) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{formatNumber(e.liters, 1)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold tabular-nums">{formatTL(e.totalCost)}</td>
                    <td className="max-w-[7rem] truncate py-2.5 text-slate-500 dark:text-slate-400">{e.createdBy ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function VehicleDot({ vehicle }: { vehicle: Vehicle }) {
  return (
    <span
      data-accent={FUEL_ACCENT[vehicle.fuelType]}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"
    >
      <Fuel size={13} />
    </span>
  );
}
