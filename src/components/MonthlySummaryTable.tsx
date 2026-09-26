import type { MonthlySummary } from "../types";
import { CONSUMPTION_KIND_LABELS, formatConsumption, formatMonth, formatNumber, formatTL } from "../lib/format";

/** Below this many km a monthly consumption figure is too shaky to lean on. */
const LOW_DATA_KM = 300;

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
            <th className="px-3 py-2 font-medium">Dolum</th>
            <th className="px-3 py-2 font-medium">Litre</th>
            <th className="px-3 py-2 font-medium">Yakıt</th>
            <th className="px-3 py-2 font-medium">Diğer Masraf</th>
            <th className="px-3 py-2 font-medium">Genel Toplam</th>
            <th className="px-3 py-2 font-medium">Ort. TL/L</th>
            <th className="px-3 py-2 font-medium">Ort. L/100km</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const hasFuel = s.fillCount > 0;
            return (
              <tr key={s.month} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <td className="px-3 py-2 font-medium capitalize whitespace-nowrap">{formatMonth(s.month)}</td>
                <td className="px-3 py-2">{s.fillCount}</td>
                <td className="px-3 py-2 whitespace-nowrap">{hasFuel ? `${formatNumber(s.totalLiters)} L` : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatTL(s.totalCost)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.otherCost > 0 ? formatTL(s.otherCost) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">{formatTL(s.grandTotal)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{hasFuel ? formatNumber(s.avgPricePerLiter, 2) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {s.avgConsumptionPer100km != null && s.consumptionKind ? (
                    <span
                      title={`${CONSUMPTION_KIND_LABELS[s.consumptionKind]}, ${formatNumber(s.consumptionKm, 0)} km üzerinden`}
                    >
                      {formatConsumption(s.avgConsumptionPer100km, s.consumptionKind)}
                      {s.consumptionKm < LOW_DATA_KM ? (
                        <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">az veri</span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
