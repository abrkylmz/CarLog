import { Car, Download, Users } from "lucide-react";
import { CONSUMPTION_KIND_LABELS, formatConsumption, formatNumber, formatTL, FUEL_TYPE_LABELS } from "../lib/format";
import type { Vehicle, VehicleStats } from "../types";

interface Props {
  vehicle: Vehicle;
  subtitle: string | null;
  stats: VehicleStats;
  onExport: () => void;
}

/** Accent-colored header card of a vehicle page: name, plate and the three figures people check most. */
export default function VehicleHero({ vehicle, subtitle, stats, onExport }: Props) {
  const thisMonth = stats.thisMonthCost + stats.thisMonthOtherCost;
  const chips: { label: string; value: string; title?: string }[] = [
    { label: "Bu ay", value: formatTL(thisMonth) },
    {
      label: "Ort. tüketim",
      value:
        stats.avgConsumptionPer100km != null
          ? `${formatConsumption(stats.avgConsumptionPer100km, stats.consumptionKind)} L/100km`
          : "—",
      title: stats.consumptionKind ? CONSUMPTION_KIND_LABELS[stats.consumptionKind] : undefined,
    },
    { label: "Son km", value: stats.latestOdometerKm != null ? formatNumber(stats.latestOdometerKm, 0) : "—" },
  ];

  return (
    <section className="rise relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-4 text-white shadow-lg shadow-brand-900/20 sm:p-5">
      {/* Soft light blob for depth; purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div className="rounded-xl bg-white/15 p-2.5 ring-1 ring-white/20">
          <Car size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">{vehicle.name}</h2>
          <p className="truncate text-sm text-white/80">
            {[subtitle, FUEL_TYPE_LABELS[vehicle.fuelType]].filter(Boolean).join(" · ")}
          </p>
          {vehicle.myRole === "helper" ? (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs ring-1 ring-white/20">
                <Users size={12} />
                Sahibi: {vehicle.ownerName ?? "—"}
              </span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onExport}
          aria-label="Dışa aktar"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/25 transition hover:bg-white/25"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Dışa Aktar</span>
        </button>
      </div>

      <dl className="relative mt-4 grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15" title={c.title}>
            <dt className="text-[11px] text-white/75">{c.label}</dt>
            <dd className="truncate text-sm font-semibold sm:text-base">{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
