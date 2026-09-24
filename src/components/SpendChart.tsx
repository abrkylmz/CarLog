import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlySummary } from "../types";
import { formatMonth, formatTL } from "../lib/format";

interface Props {
  summaries: MonthlySummary[];
}

export default function SpendChart({ summaries }: Props) {
  const data = [...summaries]
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((s) => ({ month: s.month, label: formatMonth(s.month), totalCost: s.totalCost }));

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Grafik için henüz veri yok.
      </p>
    );
  }

  return (
    <div className="h-64 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
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
            cursor={{ fill: "rgba(47,135,245,0.08)" }}
            formatter={(value: number) => [formatTL(value), "Toplam"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
          />
          <Bar dataKey="totalCost" fill="#2f87f5" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
