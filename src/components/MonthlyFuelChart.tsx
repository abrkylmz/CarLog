import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTL } from "../lib/format";
import { prefersReducedMotion } from "../lib/motion";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

interface Props {
  year: number;
  /** Fuel spend per month, January first. */
  values: number[];
  /** Month (0–11) drawn strongest: the current one, or the latest with data. */
  highlight: number | null;
}

/** The year's fuel spend month by month; the highlighted month (or the hovered one) stands out. */
export default function MonthlyFuelChart({ year, values, highlight }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const data = values.map((value, i) => ({ month: MONTHS[i], value, i }));
  const strong = hover ?? highlight;
  const total = values.reduce((t, v) => t + v, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Aylık Yakıt Gideri</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {year} · <b className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">{formatTL(total).replace(",00", "")}</b>
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 4, bottom: 0, left: -12 }}
            onMouseMove={(state) => setHover(typeof state?.activeTooltipIndex === "number" ? state.activeTooltipIndex : null)}
            onMouseLeave={() => setHover(null)}
          >
            <CartesianGrid vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-slate-500 dark:text-slate-400"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-slate-400 dark:text-slate-500"
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
                  className={`transition-colors duration-200 ${
                    d.i === strong ? "fill-brand-600 dark:fill-brand-400" : "fill-brand-200 dark:fill-brand-800"
                  }`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
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
