import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { Expense, FuelEntry, MonthlySummary } from "../types";
import EmptyState from "./EmptyState";
import { AXIS, SERIES, SERIES_BG, usePrefersDark } from "../lib/chartColors";
import { chartNotes } from "../lib/chartNotes";
import { NoteList, noteMarks } from "./ChartNotes";
import { formatMonth, formatTL } from "../lib/format";
import { prefersReducedMotion } from "../lib/motion";

interface Props {
  summaries: MonthlySummary[];
  /** The records behind the summaries, for the notes (price jumps, a big one-off cost). */
  entries?: FuelEntry[];
  expenses?: Expense[];
}

/** Monthly spend as stacked bars: fuel at the base, other expenses on top. */
export default function SpendChart({ summaries, entries = [], expenses = [] }: Props) {
  const dark = usePrefersDark();
  // Surface color doubles as the 2px gap between stacked segments.
  const surface = dark ? "#0f172a" : "#ffffff";

  const data = [...summaries]
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((s) => ({ month: s.month, label: formatMonth(s.month), fuel: s.totalCost, other: s.otherCost, total: s.grandTotal }));
  const notes = useMemo(() => chartNotes(data.map((d) => d.month), entries, expenses), [data.map((d) => d.month).join(), entries, expenses]);
  const marks = useMemo(() => noteMarks(notes), [notes]);
  const hasOther = data.some((d) => d.other > 0);
  // Bars grow up from the axis when the chart appears; other expenses follow the fuel segment.
  const animate = !prefersReducedMotion();

  if (data.length === 0) {
    return (
      <EmptyState icon={BarChart3} title="Grafik için henüz veri yok" text="İlk dolum veya masrafla aylık harcama burada belirir." />
    );
  }

  return (
    <div className="card p-4">
      {hasOther ? (
        <div className="mb-2 flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          <LegendItem className={SERIES_BG.fuel} label="Yakıt" />
          <LegendItem className={SERIES_BG.other} label="Diğer masraflar" />
        </div>
      ) : null}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className={AXIS.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className={AXIS.tick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className={AXIS.tick}
              width={64}
              tickFormatter={(v: number) => formatTL(v).replace(",00", "")}
            />
            <Tooltip
              cursor={{ fill: dark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.05)" }}
              content={<SpendTooltip />}
            />
            <Bar
              dataKey="fuel"
              name="Yakıt"
              stackId="spend"
              stroke={surface}
              strokeWidth={hasOther ? 1 : 0}
              radius={hasOther ? 0 : [4, 4, 0, 0]}
              maxBarSize={40}
              isAnimationActive={animate}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((d) => (
                <Cell key={d.month} className={SERIES.fuel.fill} />
              ))}
              {hasOther ? null : <LabelList dataKey="fuel" content={marks} />}
            </Bar>
            {hasOther ? (
              <Bar
                dataKey="other"
                name="Diğer masraflar"
                stackId="spend"
                stroke={surface}
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={animate}
                animationBegin={350}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {data.map((d) => (
                  <Cell key={d.month} className={SERIES.other.fill} />
                ))}
                <LabelList dataKey="other" content={marks} />
              </Bar>
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <NoteList notes={notes} />
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

interface TooltipPayload {
  payload: { label: string; fuel: number; other: number; total: number };
}

function SpendTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold capitalize text-slate-800 dark:text-slate-100">{d.label}</p>
      <TooltipRow className={SERIES_BG.fuel} label="Yakıt" value={d.fuel} />
      {d.other > 0 ? <TooltipRow className={SERIES_BG.other} label="Diğer" value={d.other} /> : null}
      {d.other > 0 ? (
        <p className="mt-1 flex justify-between gap-4 border-t border-slate-100 pt-1 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
          <span>Toplam</span>
          <span>{formatTL(d.total)}</span>
        </p>
      ) : null}
    </div>
  );
}

function TooltipRow({ className, label, value }: { className: string; label: string; value: number }) {
  return (
    <p className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-sm ${className}`} />
        {label}
      </span>
      <span className="font-medium text-slate-800 dark:text-slate-100">{formatTL(value)}</span>
    </p>
  );
}
