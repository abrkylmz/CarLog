import type { MonthlySummary } from "../types";
import { formatMonth, formatNumber, formatTL } from "../lib/format";

interface Props {
  summaries: MonthlySummary[];
}

export default function MonthlySummaryTable({ summaries }: Props) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <th className="px-3 py-2 font-medium">Ay</th>
            <th className="px-3 py-2 font-medium">Dolum Sayısı</th>
            <th className="px-3 py-2 font-medium">Toplam Litre</th>
            <th className="px-3 py-2 font-medium">Toplam Tutar</th>
            <th className="px-3 py-2 font-medium">Ort. TL/L</th>
            <th className="px-3 py-2 font-medium">Ort. L/100km</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.month} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
              <td className="px-3 py-2 font-medium capitalize whitespace-nowrap">{formatMonth(s.month)}</td>
              <td className="px-3 py-2">{s.fillCount}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatNumber(s.totalLiters)} L</td>
              <td className="px-3 py-2 whitespace-nowrap font-medium">{formatTL(s.totalCost)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatNumber(s.avgPricePerLiter, 2)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                {s.avgConsumptionPer100km != null ? formatNumber(s.avgConsumptionPer100km) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
