import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpDown, ArrowUpRight, BarChart3, Bell, Check, Crown, Download, Fuel, Plus, Users } from "lucide-react";
import CarArt from "../components/CarArt";
import FuelPricesCard from "../components/FuelPricesCard";
import StartChecklist from "../components/StartChecklist";
import TodayStrip, { type NextTask } from "../components/TodayStrip";
import LegacyImportBanner from "../components/LegacyImportBanner";
// The chart library is large; the cards and figures show first, the chart follows.
const MonthlyFuelChart = lazy(() => import("../components/MonthlyFuelChart"));
import RecentEntries from "../components/RecentEntries";
import { CountUp } from "../components/StatCard";
import { openQuickAdd } from "../components/QuickAdd";
import { YearSelect } from "../components/TopBar";
import VehicleCard from "../components/VehicleCard";
import VehicleCarousel from "../components/VehicleCarousel";
import { vehicleStats } from "../lib/calc";
import { dashboard, recentMonthlySpend } from "../lib/dashboard";
import { formatConsumption, formatNumber, formatTL } from "../lib/format";
import { useFuelPrices } from "../lib/fuelPrices";
import { reminderTitle } from "../components/Reminders";
import { useSession } from "../lib/session";
import { usePopover } from "../lib/popover";
import { reminderStatus } from "../lib/reminders";
import { paths } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { Plan } from "../lib/plans";
import type { Expense, FuelEntry, Reminder, Vehicle } from "../types";

interface Props {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
  /** The user's plan, for the "2 / 2 araç" usage and the add tile at the limit. */
  plan: Plan;
  /** Vehicles the user may own (Infinity for admins). */
  limit: number;
  /** Monthly spending target for the budget ring (null: not set). */
  budget: number | null;
  onEditBudget: () => void;
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

export default function HomePage({ vehicles, entries, expenses, reminders, year, years, onYearChange, plan, limit, budget, onEditBudget, onReload, onExport }: Props) {
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
            v.odometerKm,
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
  const session = useSession();
  const prices = useFuelPrices(session?.user);

  // The one reminder to look at today: anything overdue first, then the nearest.
  const nextTask = useMemo<NextTask | null>(() => {
    const rank = { overdue: 0, soon: 1, planned: 2, done: 3 } as const;
    const open = reminders
      .filter((r) => !r.doneAt)
      .map((r) => ({ r, st: reminderStatus(r, statsByVehicle.get(r.vehicleId)?.latestOdometerKm ?? null) }))
      .filter((x) => x.st.level !== "done" && x.st.text)
      .sort((a, b) => rank[a.st.level] - rank[b.st.level] || (a.r.dueDate ?? "9999").localeCompare(b.r.dueDate ?? "9999"));
    const top = open[0];
    if (!top) return null;
    const v = vehicles.find((x) => x.id === top.r.vehicleId);
    return { title: reminderTitle(top.r), vehicleName: v?.name ?? "", vehicleId: top.r.vehicleId, when: top.st.text, overdue: top.st.level === "overdue" };
  }, [reminders, statsByVehicle, vehicles]);

  // The fuel most of the user's vehicles take: whose price "Bugün" shows.
  const mainFuel = useMemo(() => {
    const count = new Map<Vehicle["fuelType"], number>();
    for (const v of vehicles) count.set(v.fuelType, (count.get(v.fuelType) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [vehicles]);

  const banner = <LegacyImportBanner onImported={onReload} />;

  if (vehicles.length === 0) {
    return (
      <>
        {banner}
        <EmptyGarage />
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
  const atLimit = owned.length >= limit;
  const addTile = (
    <a
      key="new"
      href={atLimit ? paths.plans : paths.newVehicle}
      className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:bg-brand-900/10 dark:hover:text-brand-300"
    >
      <span className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        {atLimit ? <Crown size={22} className="text-amber-500" /> : <Plus size={22} />}
      </span>
      {atLimit ? "Daha fazla araç için paketini yükselt" : "Yeni araç ekle"}
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
        board={board}
        vehicleCount={board.vehiclesWithFuel}
        yearPicker={<YearSelect years={years} value={year} onChange={onYearChange} />}
        firstVehicleId={vehicles[0].id}
      />

      <TodayStrip
        spent={board.thisMonth.total}
        budget={budget}
        onEditBudget={onEditBudget}
        task={nextTask}
        firstVehicleId={owned[0]?.id ?? vehicles[0].id}
        fuel={mainFuel}
      />

      {session ? (
        <StartChecklist
          userId={session.user.id}
          firstVehicleId={owned[0]?.id ?? vehicles[0].id}
          hasEntry={entries.length > 0}
          hasConsumption={[...statsByVehicle.values()].some((st) => st.avgConsumptionPer100km != null)}
          hasReminder={reminders.length > 0}
          hasCity={Boolean(prices.city)}
          hasBudget={budget != null}
          onEditBudget={onEditBudget}
        />
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            Araçlarım
            <span className="rounded-lg bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {Number.isFinite(limit) ? `${owned.length} / ${limit} araç` : `${owned.length} araç`}
            </span>
            <a
              href={paths.plans}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
            >
              <Crown size={12} />
              {Number.isFinite(limit) ? plan.name : "Tüm özellikler"}
            </a>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="tap inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
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

      <FuelPricesCard fuelTypes={[...new Set(vehicles.map((v) => v.fuelType))]} />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <RecentEntries vehicles={vehicles} entries={entries.filter((e) => e.date.startsWith(`${year}-`))} />
        <Suspense fallback={<div className="skeleton h-80 rounded-2xl" />}>
        <MonthlyFuelChart
          year={year}
          values={board.monthlyFuel}
          highlight={thisYear && board.monthlyFuel[new Date().getMonth()] > 0 ? new Date().getMonth() : lastFill >= 0 ? lastFill : null}
          entries={entries}
          expenses={expenses}
        />
        </Suspense>
      </section>
    </div>
  );
}

function Hero({
  year,
  thisYear,
  board,
  vehicleCount,
  yearPicker,
  firstVehicleId,
}: {
  year: number;
  thisYear: boolean;
  board: ReturnType<typeof dashboard>;
  vehicleCount: number;
  yearPicker: React.ReactNode;
  firstVehicleId: string;
}) {
  const hasData = board.fuelCost + board.otherCost > 0;
  const c = board.consumption;
  const figures = [
    { label: "Yakıt", value: tl(board.fuelCost) },
    { label: "Diğer masraflar", value: tl(board.otherCost) },
    {
      label: "Ortalama tüketim",
      value: c.per100km != null ? `${formatConsumption(c.per100km, c.kind)} L/100km` : "—",
      hint: c.per100km == null ? "2. full dolumda" : undefined,
      change: c.change,
      lowerIsBetter: true,
    },
    { label: "Yol", value: `${formatNumber(board.km.total, 0)} km`, change: board.km.change },
  ];

  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white shadow-xl shadow-brand-900/20">
      {/* Evening sky: a warm glow on the horizon behind layered hills. */}
      <div aria-hidden className="absolute -right-10 bottom-0 h-48 w-[28rem] rounded-full bg-amber-300/30 blur-3xl" />
      <svg aria-hidden viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3/5 w-full">
        <path d="M0 140 L90 95 L170 120 L260 70 L360 115 L450 80 L540 110 L640 60 L720 95 L800 75 L800 200 L0 200 Z" className="fill-white/[0.07]" />
        <path d="M0 165 L120 130 L230 150 L340 120 L470 155 L590 125 L700 150 L800 130 L800 200 L0 200 Z" className="fill-slate-950/20" />
        <path d="M0 200 L0 185 C200 175 600 175 800 185 L800 200 Z" className="fill-slate-950/30" />
      </svg>

      <div data-accent="dizel" className="pointer-events-none absolute right-6 top-8 hidden w-[17rem] drop-shadow-2xl md:block lg:right-10 xl:w-[21rem]">
        <CarArt className="h-auto w-full" />
      </div>

      <div className="relative flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-white/85">{thisYear ? `${year} · bu yıl şimdiye kadar` : `${year} yılında`}</p>
          <div className="text-slate-900 sm:hidden dark:text-slate-100">{yearPicker}</div>
        </div>

        {hasData ? (
          <div className="max-w-[min(34rem,60%)] max-sm:max-w-none">
            <p className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
              <CountUp to={board.fuelCost + board.otherCost} format={tl} />
            </p>
            <p className="mt-1 text-sm text-white/85">
              {vehicleCount} aracın toplam harcaması
            </p>
          </div>
        ) : (
          <div className="max-w-md">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{thisYear ? "Yıl yeni başlıyor" : `${year} yılında kayıt yok`}</h2>
            <p className="mt-1 text-white/85">İlk dolumunu kaydet; harcama, tüketim ve yol burada birikmeye başlasın.</p>
            {thisYear ? (
              <button
                type="button"
                onClick={() => openQuickAdd("entry", firstVehicleId)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
              >
                <Fuel size={16} />
                İlk dolumu ekle
              </button>
            ) : null}
          </div>
        )}

        {hasData ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:max-w-[min(44rem,70%)]">
            {figures.map((x) => {
              const showChange = x.change != null && x.change !== 0;
              const good = showChange && (x.lowerIsBetter ? x.change! < 0 : x.change! > 0);
              return (
                <div key={x.label} className="rounded-2xl bg-white/[0.12] px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                  <dt className="truncate text-[11px] font-medium text-white/80">{x.label}</dt>
                  <dd className="mt-0.5 truncate text-base font-bold tabular-nums tracking-tight sm:text-lg">{x.value}</dd>
                  {showChange ? (
                    <dd className={`mt-0.5 inline-flex items-center gap-0.5 rounded-md px-1 text-[11px] font-semibold ${good ? "bg-emerald-400/20 text-emerald-100" : "bg-rose-400/20 text-rose-100"}`}>
                      {x.change! < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}%{Math.abs(x.change!)} <span className="font-medium text-white/75">{year - 1}'e göre</span>
                    </dd>
                  ) : x.hint ? (
                    <dd className="mt-0.5 text-[11px] text-white/75">{x.hint}</dd>
                  ) : null}
                </div>
              );
            })}
          </dl>
        ) : null}

        {hasData ? (
          <a
            href={paths.wrapped(year)}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
          >
            <BarChart3 size={16} />
            Yıl Özeti
            <ArrowRight size={16} />
          </a>
        ) : null}
      </div>
    </section>
  );
}

/** First visit: what the app is for, and the one thing to do. */
function EmptyGarage() {
  const points = [
    { icon: Fuel, title: "Gerçek tüketimini öğren", text: "Dolumlarından L/100 km ve km başına maliyet" },
    { icon: Bell, title: "Muayeneyi, sigortayı unutma", text: "Zamanı gelince bildirim" },
    { icon: BarChart3, title: "Paranın nereye gittiğini gör", text: "Aylık rapor ve Yıl Özeti" },
  ];
  return (
    <section className="card overflow-hidden">
      <div className="relative flex h-44 items-end justify-center overflow-hidden bg-gradient-to-b from-brand-100 via-brand-50 to-transparent dark:from-brand-900/50 dark:via-brand-900/20">
        <div aria-hidden className="absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-600/25" />
        <CarArt className="relative h-28 w-auto drop-shadow-xl" />
      </div>
      <div className="px-5 pb-6 pt-4 text-center sm:px-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Garajın seni bekliyor</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Aracını ekle; yakıtın, masrafların ve bakımın tek yerde toplansın.</p>
        <ul className="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                <p.icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{p.title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <a
          href={paths.newVehicle}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-700"
        >
          <Plus size={18} />
          İlk aracını ekle
        </a>
      </div>
    </section>
  );
}

/** The sort menu's width (w-56). */
const MENU_WIDTH = 224;

function SortMenu({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const { open, toggle, setOpen, ref } = usePopover();
  // The button sits on the right on wide screens but on the left on phones (the toolbar wraps),
  // so the menu opens towards whichever side has room instead of off the screen.
  const [alignRight, setAlignRight] = useState(true);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setAlignRight(box.left + MENU_WIDTH > window.innerWidth - 12);
          toggle();
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
      >
        <ArrowUpDown size={15} />
        <span className="max-sm:hidden">Sıralama</span>
      </button>
      {open ? (
        <div
          className={`surface-raised pop-in absolute ${alignRight ? "right-0" : "left-0"} z-30 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl py-1 text-sm`}
        >
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

