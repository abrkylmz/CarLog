import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Car,
  Check,
  Download,
  Droplet,
  Fuel,
  Plus,
  Route,
  Users,
} from "lucide-react";
import CarArt from "../components/CarArt";
import LegacyImportBanner from "../components/LegacyImportBanner";
import MonthlyFuelChart from "../components/MonthlyFuelChart";
import RecentEntries from "../components/RecentEntries";
import { CountUp } from "../components/StatCard";
import { YearSelect } from "../components/TopBar";
import VehicleCard from "../components/VehicleCard";
import VehicleCarousel from "../components/VehicleCarousel";
import { vehicleStats } from "../lib/calc";
import { dashboard, recentMonthlySpend } from "../lib/dashboard";
import { formatConsumption, formatNumber, formatTL } from "../lib/format";
import { usePopover } from "../lib/popover";
import { reminderStatus } from "../lib/reminders";
import { paths } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { Expense, FuelEntry, Reminder, Vehicle } from "../types";

interface Props {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
  onReload: () => void;
  onExport: () => void;
}

const tl = (n: number) => formatTL(n).replace(",00", "");

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

type SortKey = "added" | "name" | "recent" | "spend";
const SORT_LABELS: Record<SortKey, string> = {
  added: "Eklenme sırası",
  name: "Ada göre",
  recent: "Son doluma göre",
  spend: "Bu ayki harcamaya göre",
};
const SORT_KEY = "carlog:vehicle-sort";

function useSort(): [SortKey, (key: SortKey) => void] {
  const [sort, setSortState] = useState<SortKey>(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      if (saved && saved in SORT_LABELS) return saved as SortKey;
    } catch {
      // Storage blocked: default order.
    }
    return "added";
  });
  return [
    sort,
    (key) => {
      try {
        localStorage.setItem(SORT_KEY, key);
      } catch {
        // Not remembered; still applies now.
      }
      setSortState(key);
    },
  ];
}

export default function HomePage({ vehicles, entries, expenses, reminders, year, years, onYearChange, onReload, onExport }: Props) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [sort, setSort] = useSort();

  const statsByVehicle = useMemo(
    () =>
      new Map(
        vehicles.map((v) => [
          v.id,
          vehicleStats(
            entries.filter((e) => e.vehicleId === v.id),
            expenses.filter((e) => e.vehicleId === v.id),
            v.tankCapacity,
          ),
        ]),
      ),
    [vehicles, entries, expenses],
  );
  const spendByVehicle = useMemo(
    () => new Map(vehicles.map((v) => [v.id, recentMonthlySpend(v.id, entries, expenses)])),
    [vehicles, entries, expenses],
  );
  const alertsByVehicle = useMemo(() => {
    const counts = new Map<string, { overdue: number; soon: number }>();
    for (const r of reminders) {
      if (r.doneAt) continue;
      const level = reminderStatus(r, statsByVehicle.get(r.vehicleId)?.latestOdometerKm ?? null).level;
      if (level !== "overdue" && level !== "soon") continue;
      const c = counts.get(r.vehicleId) ?? { overdue: 0, soon: 0 };
      c[level] += 1;
      counts.set(r.vehicleId, c);
    }
    return counts;
  }, [reminders, statsByVehicle]);
  const board = useMemo(() => dashboard(year, vehicles, entries, expenses), [year, vehicles, entries, expenses]);

  const banner = <LegacyImportBanner onImported={onReload} />;

  if (vehicles.length === 0) {
    return (
      <>
        {banner}
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700">
          <div className="mb-4 rounded-full bg-brand-50 p-4 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <Car size={32} />
          </div>
          <h2 className="text-lg font-semibold">Garajınız boş</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Yakıt giderlerini takip etmeye başlamak için ilk aracınızı ekleyin.
          </p>
          <a
            href={paths.newVehicle}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            Araç Ekle
          </a>
        </div>
      </>
    );
  }

  const sorted = (list: Vehicle[]) => {
    const s = (v: Vehicle) => statsByVehicle.get(v.id)!;
    const copy = [...list];
    if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (sort === "recent") copy.sort((a, b) => (s(b).lastFillDate ?? "").localeCompare(s(a).lastFillDate ?? ""));
    if (sort === "spend")
      copy.sort((a, b) => s(b).thisMonthCost + s(b).thisMonthOtherCost - (s(a).thisMonthCost + s(a).thisMonthOtherCost));
    return copy;
  };
  const owned = sorted(vehicles.filter((v) => v.myRole === "owner"));
  const shared = sorted(vehicles.filter((v) => v.myRole !== "owner"));
  const card = (vehicle: Vehicle) => (
    <VehicleCard
      key={vehicle.id}
      vehicle={vehicle}
      stats={statsByVehicle.get(vehicle.id)!}
      alerts={alertsByVehicle.get(vehicle.id)}
      spend={spendByVehicle.get(vehicle.id)!}
    />
  );
  const addTile = (
    <a
      key="new"
      href={paths.newVehicle}
      className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:bg-brand-900/10 dark:hover:text-brand-300"
    >
      <span className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        <Plus size={22} />
      </span>
      Yeni araç ekle
    </a>
  );
  const strip = (list: Vehicle[], label: string, withAdd: boolean) =>
    wide ? (
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
        {list.map(card)}
        {withAdd ? addTile : null}
      </div>
    ) : (
      <VehicleCarousel
        label={label}
        accents={[...list.map((v) => FUEL_ACCENT[v.fuelType]), ...(withAdd ? [undefined] : [])]}
        titles={[...list.map((v) => v.name), ...(withAdd ? ["Yeni araç"] : [])]}
      >
        {list.map(card)}
        {withAdd ? addTile : null}
      </VehicleCarousel>
    );

  const thisYear = year === new Date().getFullYear();
  const lastFill = Math.max(-1, ...board.monthlyFuel.map((v, i) => (v > 0 ? i : -1)));

  return (
    <div className="flex flex-col gap-6">
      {banner}

      <Hero
        year={year}
        thisYear={thisYear}
        fuelCost={board.fuelCost}
        otherCost={board.otherCost}
        vehicleCount={board.vehiclesWithFuel}
        hasData={board.fuelCost > 0}
        yearPicker={<YearSelect years={years} value={year} onChange={onYearChange} />}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          icon={Fuel}
          tone="emerald"
          label="Bu Ay Toplam"
          value={<CountUp to={board.thisMonth.total} format={tl} />}
          change={board.thisMonth.change}
          changeHint="Geçen ayın aynı dönemine göre"
          lowerIsBetter
        />
        <Stat
          icon={BarChart3}
          tone="brand"
          label="Genel Toplam"
          value={<CountUp to={board.fuelCost + board.otherCost} format={tl} />}
          hint={`Tüm araçlar · ${year}`}
        />
        <Stat
          icon={Droplet}
          tone="rose"
          label="Ortalama Tüketim"
          value={
            board.consumption.per100km != null ? (
              <>
                {formatConsumption(board.consumption.per100km, board.consumption.kind)}
                <span className="ml-1 text-base font-semibold">L/100km</span>
              </>
            ) : (
              "—"
            )
          }
          change={board.consumption.change}
          changeHint={`${year - 1} yılına göre`}
          hint={board.consumption.per100km == null ? "Henüz ölçülmedi" : undefined}
          lowerIsBetter
        />
        <Stat
          icon={Route}
          tone="slate"
          label="Toplam Kilometre"
          value={<CountUp to={board.km.total} format={(n) => `${formatNumber(n, 0)} km`} />}
          hint={`Tüm araçlar · ${year}`}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            Araçlarım
            <span className="rounded-lg bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {owned.length} araç
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Dışa Aktar"
            >
              <Download size={16} />
            </button>
            <SortMenu value={sort} onChange={setSort} />
            <a
              href={paths.newVehicle}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-700"
            >
              <Plus size={16} />
              Araç Ekle
            </a>
          </div>
        </div>
        {strip(owned, "Araçlarım", true)}
      </section>

      {shared.length > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold tracking-tight">
            <Users size={18} />
            Benimle Paylaşılanlar
          </h2>
          {strip(shared, "Benimle Paylaşılanlar", false)}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <RecentEntries vehicles={vehicles} entries={entries.filter((e) => e.date.startsWith(`${year}-`))} />
        <MonthlyFuelChart
          year={year}
          values={board.monthlyFuel}
          highlight={thisYear && board.monthlyFuel[new Date().getMonth()] > 0 ? new Date().getMonth() : lastFill >= 0 ? lastFill : null}
        />
      </section>
    </div>
  );
}

function Hero({
  year,
  thisYear,
  fuelCost,
  otherCost,
  vehicleCount,
  hasData,
  yearPicker,
}: {
  year: number;
  thisYear: boolean;
  fuelCost: number;
  otherCost: number;
  vehicleCount: number;
  hasData: boolean;
  yearPicker: React.ReactNode;
}) {
  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white shadow-xl shadow-brand-900/20">
      {/* Evening sky: a warm glow on the horizon behind layered hills. */}
      <div aria-hidden className="absolute -right-10 bottom-0 h-48 w-[28rem] rounded-full bg-amber-300/30 blur-3xl" />
      <svg aria-hidden viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3/5 w-full">
        <path d="M0 140 L90 95 L170 120 L260 70 L360 115 L450 80 L540 110 L640 60 L720 95 L800 75 L800 200 L0 200 Z" className="fill-white/[0.07]" />
        <path d="M0 165 L120 130 L230 150 L340 120 L470 155 L590 125 L700 150 L800 130 L800 200 L0 200 Z" className="fill-slate-950/20" />
        <path d="M0 200 L0 185 C200 175 600 175 800 185 L800 200 Z" className="fill-slate-950/30" />
      </svg>

      <div className="relative flex min-h-[11rem] flex-col justify-between gap-4 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-white/80">{year}</p>
          <div className="text-slate-900 sm:hidden dark:text-slate-100">{yearPicker}</div>
        </div>
        <div className="max-w-[min(34rem,62%)] max-sm:max-w-none">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{thisYear ? "Bu yıl şimdiye kadar" : `${year} yılında`}</h2>
          {hasData ? (
            <p className="mt-1 text-white/90 sm:text-lg">
              Toplam {vehicleCount} aracınızla <b className="font-bold text-white">{tl(fuelCost)}</b> yakıt harcadınız.
              {otherCost > 0 ? <span className="block text-sm text-white/70">Diğer masraflar: {tl(otherCost)}</span> : null}
            </p>
          ) : (
            <p className="mt-1 text-white/85">Bu yıl için henüz dolum kaydı yok.</p>
          )}
        </div>
      </div>

      <div data-accent="dizel" className="pointer-events-none absolute bottom-1 right-6 hidden w-[19rem] drop-shadow-2xl md:block lg:right-48 xl:w-[23rem]">
        <CarArt className="h-auto w-full" />
      </div>

      {hasData ? (
        <a
          href={paths.wrapped(year)}
          className="relative mx-5 mb-5 inline-flex w-fit items-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50 sm:absolute sm:bottom-7 sm:right-7 sm:m-0"
        >
          <BarChart3 size={16} />
          Yıl Özeti
          <ArrowRight size={16} />
        </a>
      ) : null}
    </section>
  );
}

const TONES = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  change,
  changeHint,
  lowerIsBetter,
}: {
  icon: typeof Fuel;
  tone: keyof typeof TONES;
  label: string;
  value: React.ReactNode;
  hint?: string;
  change?: number | null;
  changeHint?: string;
  lowerIsBetter?: boolean;
}) {
  const showChange = change != null && change !== 0;
  const good = showChange && (lowerIsBetter ? change! < 0 : change! > 0);
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <span className={`hidden rounded-xl p-3 sm:block ${TONES[tone]}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
        {showChange ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className={`inline-flex items-center font-semibold ${good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {change! < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}%{Math.abs(change!)}
            </span>
            <span className="text-slate-400 dark:text-slate-500">{changeHint}</span>
          </p>
        ) : hint ? (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        ) : changeHint ? (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{changeHint}</p>
        ) : null}
      </div>
    </div>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const { open, toggle, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
      >
        <ArrowUpDown size={15} />
        <span className="max-sm:hidden">Sıralama</span>
      </button>
      {open ? (
        <div className="pop-in absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {SORT_LABELS[key]}
              {key === value ? <Check size={15} className="text-brand-600 dark:text-brand-300" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

