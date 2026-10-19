import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, CATEGORY_BG, SERIES } from "../lib/chartColors";
import { chartNotes } from "../lib/chartNotes";
import { NoteList, noteMarks } from "./ChartNotes";
import { EXPENSE_CATEGORY_LABELS, formatNumber, formatTL } from "../lib/format";
import type { Expense, FuelEntry } from "../types";
import { prefersReducedMotion } from "../lib/motion";
import { YearSelect } from "./TopBar";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

interface Props {
  year: number;
  /** Fuel spend per month, January first. */
  values: number[];
  /** Month (0–11) drawn strongest: the current one, or the latest with data. */
  highlight: number | null;
  /** When given, the card carries its own year picker. */
  years?: number[];
  onYearChange?: (year: number) => void;
  /** The records behind the chart (same vehicles), for the breakdown of a tapped month. */
  entries: FuelEntry[];
  expenses: Expense[];
}

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** The year's fuel spend month by month; the highlighted month (or the hovered one) stands out. */
export default function MonthlyFuelChart({ year, values, highlight, years, onYearChange, entries, expenses }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  // The month whose breakdown is shown; a tap (or click) on a bar picks it.
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? highlight;
  const data = values.map((value, i) => ({ month: MONTHS[i], value, i }));
  const strong = hover ?? selected;
  const pick = (index: unknown) => {
    const i = typeof index === "number" ? index : typeof index === "string" ? Number(index) : NaN;
    if (Number.isInteger(i) && i >= 0 && i < 12) setPicked(i);
  };
  const total = values.reduce((t, v) => t + v, 0);
  const notes = useMemo(
    () => chartNotes(MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`), entries, expenses),
    [year, entries, expenses],
  );
  const marks = useMemo(() => noteMarks(notes), [notes]);

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Aylık Yakıt Gideri</h2>
        {years && onYearChange ? (
          <YearSelect years={years} value={year} onChange={onYearChange} />
        ) : null}
      </div>
      <p className="-mt-1 mb-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {year} toplamı · <b className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">{formatTL(total).replace(",00", "")}</b>
        </span>
      </p>
      {total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          {/* A faint silhouette of the chart to come, rather than an empty grid. */}
          <div aria-hidden className="flex h-20 items-end gap-1.5">
            {[30, 45, 38, 60, 52, 75, 48, 66].map((h, i) => (
              <span key={i} className="w-3 rounded-t bg-slate-100 dark:bg-slate-800" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{year} yılında dolum yok. Kaydettikçe her ayın yakıt gideri burada çıkar.</p>
        </div>
      ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 22, right: 4, bottom: 0, left: -12 }}
            onMouseMove={(state) => setHover(typeof state?.activeTooltipIndex === "number" ? state.activeTooltipIndex : null)}
            onMouseLeave={() => setHover(null)}
            onClick={(state) => pick(state?.activeTooltipIndex)}
            className="cursor-pointer"
          >
            <CartesianGrid vertical={false} stroke="currentColor" className={AXIS.grid} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className={AXIS.tick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className={AXIS.tick}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip cursor={false} content={<MonthTooltip year={year} />} />
            <Bar
              dataKey="value"
              radius={[6, 6, 2, 2]}
              maxBarSize={30}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((d) => (
                <Cell
                  key={d.i}
                  onClick={() => setPicked(d.i)}
                  className={`transition-colors duration-200 ${
                    d.i === strong ? SERIES.fuel.fill : SERIES.fuel.soft
                  }`}
                />
              ))}
              <LabelList dataKey="value" content={marks} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
      <NoteList notes={notes} />
      {selected != null ? (
        <MonthBreakdown month={`${year}-${String(selected + 1).padStart(2, "0")}`} label={`${MONTH_NAMES[selected]} ${year}`} entries={entries} expenses={expenses} />
      ) : null}
    </section>
  );
}

/** What made up one month's spending: fuel (with fill-ups, liters, price) and the expense kinds. */
function MonthBreakdown({ month, label, entries, expenses }: { month: string; label: string; entries: FuelEntry[]; expenses: Expense[] }) {
  const fills = entries.filter((e) => e.date.startsWith(month));
  const costs = expenses.filter((x) => x.date.startsWith(month));
  const fuel = fills.reduce((t, e) => t + e.totalCost, 0);
  const liters = fills.reduce((t, e) => t + e.liters, 0);
  const byCategory = new Map<Expense["category"], number>();
  for (const x of costs) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount);
  const sorted = [...byCategory].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([c, v]) => ({ label: EXPENSE_CATEGORY_LABELS[c], value: v, color: CATEGORY_BG[c] }));
  const rest = sorted.slice(3).reduce((t, [, v]) => t + v, 0);
  const segments = [
    { label: "Yakıt", value: fuel, color: SERIES.fuel.bg },
    ...top,
    ...(rest > 0 ? [{ label: "Diğer", value: rest, color: CATEGORY_BG.diger }] : []),
  ].filter((s) => s.value > 0);
  const total = segments.reduce((t, s) => t + s.value, 0);
  const tl = (n: number) => formatTL(n).replace(",00", "");

  return (
    <div aria-live="polite" className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{label}</p>
        <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
          Toplam <b className="text-slate-800 dark:text-slate-100">{tl(total)}</b>
        </p>
      </div>
      {total === 0 ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Bu ayda kayıt yok.</p>
      ) : (
        <>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            {segments.map((s) => (
              <span key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.color}`} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="tabular-nums font-medium">{tl(s.value)}</span>
              </li>
            ))}
          </ul>
          {fills.length ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {fills.length} dolum · {formatNumber(liters, 1)} L · ortalama {formatNumber(fuel / liters, 2)} TL/L
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function MonthTooltip({ active, payload, year }: { active?: boolean; payload?: { payload: { month: string; value: number } }[]; year: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="text-slate-500 dark:text-slate-400">
        {d.month} {year}
      </p>
      <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatTL(d.value).replace(",00", "")}</p>
    </div>
  );
}
