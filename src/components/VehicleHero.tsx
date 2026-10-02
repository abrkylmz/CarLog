import { ArrowRight, BarChart3, CalendarDays, Car, ChevronRight, Download, Fuel, MoreHorizontal, Route, Users } from "lucide-react";
import { CONSUMPTION_KIND_LABELS, formatConsumption, formatNumber, formatTL, FUEL_TYPE_LABELS } from "../lib/format";
import { usePopover } from "../lib/popover";
import { paths, VEHICLE_TAB_LABELS, VEHICLE_TABS } from "../lib/router";
import type { Vehicle, VehicleStats } from "../types";
import CarArt from "./CarArt";
import { CountUp } from "./StatCard";

interface Props {
  vehicle: Vehicle;
  subtitle: string | null;
  stats: VehicleStats;
  onExport: () => void;
}

const longDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });

/**
 * Accent-colored header of a vehicle page: name, make and plate, a drawing of the car over a
 * landscape, and the four figures people check most (the last fill-up opens the fill-up list).
 */
export default function VehicleHero({ vehicle, subtitle, stats, onExport }: Props) {
  const thisMonth = stats.thisMonthCost + stats.thisMonthOtherCost;
  const makeLine = [[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || subtitle, vehicle.year, FUEL_TYPE_LABELS[vehicle.fuelType]]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className="rise relative z-20 mb-5 rounded-3xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 text-white shadow-xl shadow-brand-900/20">
      {/* Landscape: hills, a lake line and a warm glow behind the car. Clipped on its own layer, so
          the menu can still open past the card edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      <div className="absolute -right-10 top-0 h-56 w-[30rem] rounded-full bg-white/10 blur-3xl" />
      <svg viewBox="0 0 800 220" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-4/5 w-full">
        <path d="M0 150 L80 105 L150 125 L240 60 L330 118 L420 75 L520 120 L610 50 L700 100 L800 70 L800 220 L0 220 Z" className="fill-white/[0.08]" />
        <path d="M0 175 L110 140 L210 160 L330 128 L450 165 L580 132 L690 158 L800 138 L800 220 L0 220 Z" className="fill-slate-950/15" />
        <path d="M0 220 L0 196 C220 186 580 186 800 196 L800 220 Z" className="fill-slate-950/25" />
      </svg>
      </div>

      <div className="relative p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="hidden rounded-2xl bg-white/15 p-3.5 ring-1 ring-white/20 backdrop-blur sm:block">
            <Car size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{vehicle.name}</h2>
            <p className="truncate text-sm text-white/85 sm:text-base">{makeLine}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {vehicle.plate ? (
                <span className="rounded-lg bg-white/15 px-3 py-1 text-sm font-semibold tracking-wide ring-1 ring-white/20">
                  {vehicle.plate}
                </span>
              ) : null}
              <a
                href={paths.vehicle(vehicle.id, "bilgiler")}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/20"
              >
                Araç Bilgileri
                <ArrowRight size={13} />
              </a>
              {vehicle.myRole === "helper" ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs ring-1 ring-white/15">
                  <Users size={12} />
                  Sahibi: {vehicle.ownerName ?? "—"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              aria-label="Dışa aktar"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Dışa Aktar</span>
            </button>
            <HeroMenu vehicleId={vehicle.id} />
          </div>
        </div>

        <div className="pointer-events-none absolute right-[12%] top-6 hidden w-64 drop-shadow-2xl lg:block xl:w-72">
          <CarArt light className="h-auto w-full" />
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Figure icon={Fuel} label="Bu Ay">
            <CountUp to={thisMonth} format={formatTL} />
          </Figure>
          <Figure
            icon={BarChart3}
            label="Ortalama Tüketim"
            title={stats.consumptionKind ? CONSUMPTION_KIND_LABELS[stats.consumptionKind] : undefined}
          >
            {stats.avgConsumptionPer100km != null ? (
              <CountUp to={stats.avgConsumptionPer100km} format={(n) => `${formatConsumption(n, stats.consumptionKind)} L/100km`} />
            ) : (
              "—"
            )}
          </Figure>
          <Figure icon={Route} label="Son Km">
            {stats.latestOdometerKm != null ? <CountUp to={stats.latestOdometerKm} format={(n) => `${formatNumber(n, 0)} km`} /> : "—"}
          </Figure>
          <Figure icon={CalendarDays} label="Son Dolum" href={paths.vehicle(vehicle.id, "dolumlar")}>
            {stats.lastFillDate ? longDate.format(new Date(`${stats.lastFillDate}T00:00:00`)) : "—"}
          </Figure>
        </dl>
      </div>
    </section>
  );
}

function Figure({
  icon: Icon,
  label,
  title,
  href,
  children,
}: {
  icon: typeof Fuel;
  label: string;
  title?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <Icon size={22} className="hidden shrink-0 text-white/90 sm:block" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-white/75 sm:text-xs">{label}</dt>
        <dd className="truncate text-sm font-bold tabular-nums sm:text-base">{children}</dd>
      </div>
      {href ? <ChevronRight size={18} className="shrink-0 text-white/70" /> : null}
    </>
  );
  const box = "flex min-w-0 items-center gap-3 rounded-2xl bg-slate-950/20 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-md sm:px-4 sm:py-3";
  return href ? (
    <a href={href} title={title} className={`${box} transition hover:bg-slate-950/30`}>
      {body}
    </a>
  ) : (
    <div title={title} className={box}>
      {body}
    </div>
  );
}

function HeroMenu({ vehicleId }: { vehicleId: string }) {
  const { open, toggle, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Araç menüsü"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
      >
        <MoreHorizontal size={18} />
      </button>
      {open ? (
        <div className="pop-in absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {VEHICLE_TABS.map((tab) => (
            <a key={tab} href={paths.vehicle(vehicleId, tab)} className="block px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              {VEHICLE_TAB_LABELS[tab]}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
