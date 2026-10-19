import { AlertTriangle, Clock, Fuel, MoreVertical, Route, Users, Wallet, Zap } from "lucide-react";
import { formatConsumption, FUEL_TYPE_LABELS, formatNumber, formatTL } from "../lib/format";
import { usePopover } from "../lib/popover";
import { paths, VEHICLE_TAB_LABELS, type VehicleTab } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { Vehicle, VehicleStats } from "../types";
import CarArt from "./CarArt";
import { bodyTypeOf } from "../lib/bodyType";
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
/**
 * The name block: the brand above in small spaced capitals, the vehicle's own name large (without
 * the brand when the name starts with it, since it's right above), then model and year, leaving
 * out whatever the name already says.
 */
function nameParts(vehicle: Vehicle) {
  const brand = vehicle.brand?.trim() || null;
  let title = vehicle.name.trim();
  if (brand && title.toLocaleLowerCase("tr").startsWith(`${brand.toLocaleLowerCase("tr")} `)) title = title.slice(brand.length + 1);
  const model = vehicle.model?.trim();
  const showModel = model && !title.toLocaleLowerCase("tr").includes(model.toLocaleLowerCase("tr"));
  const subtitle = [showModel ? model : null, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(" · ");
  return { brand, title, subtitle };
}

export default function VehicleCard({ vehicle, stats, alerts, spend }: Props) {
  const { brand, title, subtitle } = nameParts(vehicle);
  const FuelIcon = vehicle.fuelType === "hibrit" ? Zap : Fuel;

  return (
    <article
      data-accent={FUEL_ACCENT[vehicle.fuelType]}
      className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <CardMenu vehicleId={vehicle.id} />

      <a href={paths.vehicle(vehicle.id)} className="block" aria-label={`${vehicle.name} detayları`}>
        {/* Hero: the name set like a headline at the top left, the drawing parked at the bottom right. */}
        <div className="relative -mx-4 -mt-4 h-44 overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-100/70 dark:from-brand-900/50 dark:via-slate-900 dark:to-slate-900">
          <div aria-hidden className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-brand-300/35 blur-3xl dark:bg-brand-500/20" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent dark:via-brand-800" />
          <div className="relative px-4 pr-12 pt-4">
            {/* Kept even without a brand, so names line up across the cards. */}
            <p className="h-4 truncate text-[11px] font-bold uppercase leading-4 tracking-[0.2em] text-brand-600 dark:text-brand-300">{brand}</p>
            <h3 title={vehicle.name} className="mt-1 truncate text-[clamp(1.35rem,6.4vw,1.7rem)] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle ? <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <CarArt
            body={bodyTypeOf(vehicle)}
            className="absolute -right-5 bottom-1 h-[5.25rem] w-auto drop-shadow-[0_12px_14px_rgb(var(--brand-900)/0.18)] transition duration-500 group-hover/card:-translate-x-1 group-hover/card:scale-[1.03]"
          />
        </div>

        <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
          {vehicle.plate ? <Plate value={vehicle.plate} /> : null}
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200/70 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-800">
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

/** The plate as it looks on the car: white, a blue "TR" band on the left, bold even letters. */
function Plate({ value }: { value: string }) {
  return (
    <span aria-label={`Plaka ${value}`} className="inline-flex h-7 items-stretch overflow-hidden rounded-md bg-white text-slate-900 shadow-sm ring-1 ring-slate-300 dark:ring-slate-500">
      <span aria-hidden className="flex w-[18px] items-end justify-center bg-[#1d4fb8] pb-[3px] text-[8px] font-bold leading-none text-white">
        TR
      </span>
      <span className="flex items-center px-2 font-mono text-[13px] font-bold uppercase tracking-[0.08em]">{value}</span>
    </span>
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
