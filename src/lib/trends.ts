import type { Expense, FuelEntry, MonthlySummary } from "../types";
import { monthKey } from "./calc";
import { analyzeConsumption, averageOf } from "./consumption";
import { change } from "./dashboard";

// Figures with a direction for one vehicle's summary: what changed, and a short history to draw.

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sum = (values: number[]) => values.reduce((t, v) => t + v, 0);

/** "YYYY-MM" for the last `count` months, oldest first, ending with the current one. */
function lastMonths(count: number, now: Date): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

export interface VehicleTrends {
  /** Spend so far this month against the same days of last month. */
  thisMonthChange: number | null;
  /** Fuel + other spend per month, last 8 months. */
  monthlySpend: number[];
  /** L/100km of the last 90 days against the vehicle's all-time average. */
  consumptionChange: number | null;
  /** Measured L/100km per month (months without a measurement are skipped). */
  monthlyConsumption: number[];
  /** Average price per liter over the last 6 months, weighted by liters. */
  recentPrice: number | null;
  /** That price against the 6 months before. */
  priceChange: number | null;
  /** Average price per liter per month (months without fill-ups are skipped). */
  monthlyPrice: number[];
}

export function vehicleTrends(
  entries: FuelEntry[],
  expenses: Expense[],
  summaries: MonthlySummary[],
  tankCapacity: number | undefined,
  now = new Date(),
): VehicleTrends {
  const today = localIso(now);
  const day = today.slice(8, 10);
  const months = lastMonths(8, now);
  const spendIn = (month: string, uptoDay = "31") =>
    sum(entries.filter((e) => monthKey(e.date) === month && e.date.slice(8, 10) <= uptoDay).map((e) => e.totalCost)) +
    sum(expenses.filter((x) => monthKey(x.date) === month && x.date.slice(8, 10) <= uptoDay).map((x) => x.amount));

  const { segments } = analyzeConsumption(entries, tankCapacity);
  const since90 = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
  const recent = averageOf(segments.filter((s) => s.endDate >= since90));
  const overall = averageOf(segments);

  const priceBetween = (from: string, to: string) => {
    const inRange = entries.filter((e) => e.date >= from && e.date < to);
    const liters = sum(inRange.map((e) => e.liters));
    return liters > 0 ? sum(inRange.map((e) => e.totalCost)) / liters : null;
  };
  const sixAgo = localIso(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
  const twelveAgo = localIso(new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()));
  const recentPrice = priceBetween(sixAgo, "9999");
  const earlierPrice = priceBetween(twelveAgo, sixAgo);

  const byMonth = new Map(summaries.map((s) => [s.month, s]));
  const oldestFirst = [...summaries].sort((a, b) => a.month.localeCompare(b.month));

  return {
    thisMonthChange: change(spendIn(months.at(-1)!, day), spendIn(months.at(-2)!, day)),
    monthlySpend: months.map((m) => byMonth.get(m)?.grandTotal ?? 0),
    consumptionChange:
      recent.per100km != null && overall.per100km != null && recent.km < overall.km ? change(recent.per100km, overall.per100km) : null,
    monthlyConsumption: oldestFirst
      .filter((s) => s.avgConsumptionPer100km != null)
      .slice(-8)
      .map((s) => s.avgConsumptionPer100km!),
    recentPrice,
    priceChange: recentPrice != null && earlierPrice != null ? change(recentPrice, earlierPrice) : null,
    monthlyPrice: oldestFirst
      .filter((s) => s.totalLiters > 0)
      .slice(-8)
      .map((s) => s.avgPricePerLiter),
  };
}
