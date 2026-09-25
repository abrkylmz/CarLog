import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlySummary } from "../types";
import { SERIES_BG, SERIES_COLORS, usePrefersDark } from "../lib/chartColors";
import { formatMonth, formatTL } from "../lib/format";

interface Props {
  summaries: MonthlySummary[];
}

/** Monthly spend as stacked bars: fuel at the base, other expenses on top. */
export default function SpendChart({ summaries }: Props) {
  const dark = usePrefersDark();
  const mode = dark ? "dark" : "light";
  // Surface color doubles as the 2px gap between stacked segments.
  const surface = dark ? "#0f172a" : "#ffffff";

  const data = [...summaries]
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((s) => ({ label: formatMonth(s.month), fuel: s.totalCost, other: s.otherCost, total: s.grandTotal }));
  const hasOther = data.some((d) => d.other > 0);

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Grafik için henüz veri yok.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {hasOther ? (
        <div className="mb-2 flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          <LegendItem className={SERIES_BG.fuel} label="Yakıt" />
          <LegendItem className={SERIES_BG.other} label="Diğer masraflar" />
        </div>
      ) : null}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-slate-500 dark:text-slate-400"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-slate-500 dark:text-slate-400"
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
              fill={SERIES_COLORS.fuel[mode]}
              stroke={surface}
              strokeWidth={hasOther ? 1 : 0}
              radius={hasOther ? 0 : [4, 4, 0, 0]}
              maxBarSize={40}
            />
            {hasOther ? (
              <Bar
                dataKey="other"
                name="Diğer masraflar"
                stackId="spend"
                fill={SERIES_COLORS.other[mode]}
                stroke={surface}
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
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
