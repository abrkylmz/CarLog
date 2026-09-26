import type { DerivedEntry, Expense, FuelEntry, MonthlySummary, VehicleStats } from "../types";
import { analyzeConsumption, averageOf } from "./consumption";

/**
 * One vehicle's fill-ups ordered by odometer (not date, so a mistyped date doesn't break the
 * distance math), each with the consumption of the stretch it closes. See consumption.ts.
 */
export function withDerived(entries: FuelEntry[], tankCapacity?: number): DerivedEntry[] {
  return analyzeConsumption(entries, tankCapacity).derived;
}

export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/**
 * Monthly totals for one vehicle, newest first; months with only non-fuel expenses are included too.
 * A measured stretch counts toward the month of the fill-up that closes it. When the vehicle has no
 * measurable stretch at all, each month falls back to its own liters ÷ km, marked rough.
 */
export function groupByMonth(entries: FuelEntry[], expenses: Expense[] = [], tankCapacity?: number): MonthlySummary[] {
  const { derived, segments } = analyzeConsumption(entries, tankCapacity);
  const roughOnly = segments.every((seg) => seg.kind === "rough");
  const firstId = derived[0]?.id;
  const byMonth = new Map<string, DerivedEntry[]>();
  const otherByMonth = new Map<string, number>();

  for (const entry of derived) {
    const key = monthKey(entry.date);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(entry);
    byMonth.set(key, bucket);
  }
  for (const expense of expenses) {
    const key = monthKey(expense.date);
    otherByMonth.set(key, (otherByMonth.get(key) ?? 0) + expense.amount);
    if (!byMonth.has(key)) byMonth.set(key, []);
  }

  const summaries: MonthlySummary[] = [];
  for (const [month, bucket] of byMonth) {
    const totalCost = sum(bucket.map((e) => e.totalCost));
    const totalLiters = sum(bucket.map((e) => e.liters));
    const kmDriven = sum(bucket.map((e) => e.kmSinceLast ?? 0));

    let consumption: { per100km: number | null; km: number; kind: MonthlySummary["consumptionKind"] };
    if (roughOnly) {
      // The very first fill-up's fuel was burned before any recorded distance.
      const liters = sum(bucket.filter((e) => e.id !== firstId).map((e) => e.liters));
      const plausible = kmDriven > 0 && (liters / kmDriven) * 100 >= 2 && (liters / kmDriven) * 100 <= 30;
      consumption = plausible
        ? { per100km: (liters / kmDriven) * 100, km: kmDriven, kind: "rough" }
        : { per100km: null, km: 0, kind: null };
    } else {
      consumption = averageOf(segments.filter((seg) => monthKey(seg.endDate) === month));
    }

    const otherCost = otherByMonth.get(month) ?? 0;

    summaries.push({
      month,
      totalCost,
      otherCost,
      grandTotal: totalCost + otherCost,
      totalLiters,
      fillCount: bucket.length,
      avgPricePerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
      kmDriven,
      avgConsumptionPer100km: consumption.per100km,
      consumptionKind: consumption.per100km != null ? consumption.kind : null,
      consumptionKm: consumption.km,
    });
  }

  return summaries.sort((a, b) => (a.month < b.month ? 1 : -1));
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** Pass tankCapacity for a single vehicle; for several vehicles only the money figures are meaningful. */
export function vehicleStats(entries: FuelEntry[], expenses: Expense[] = [], tankCapacity?: number): VehicleStats {
  const { derived, segments } = analyzeConsumption(entries, tankCapacity);
  const average = averageOf(segments);
  const currentMonth = monthKey(new Date().toISOString());
  const thisMonth = entries.filter((e) => monthKey(e.date) === currentMonth);
  const thisMonthExpenses = expenses.filter((e) => monthKey(e.date) === currentMonth);

  const totalCost = sum(entries.map((e) => e.totalCost));
  const totalLiters = sum(entries.map((e) => e.liters));

  return {
    fillCount: entries.length,
    totalCost,
    totalLiters,
    avgPricePerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
    thisMonthCost: sum(thisMonth.map((e) => e.totalCost)),
    thisMonthFillCount: thisMonth.length,
    otherCostTotal: sum(expenses.map((e) => e.amount)),
    thisMonthOtherCost: sum(thisMonthExpenses.map((e) => e.amount)),
    expenseCount: expenses.length,
    avgConsumptionPer100km: average.per100km,
    consumptionKind: average.kind,
    kmTracked: average.km,
    unknownFillCount: entries.filter((e) => e.isFull == null).length,
    suspiciousCount: segments.filter((seg) => seg.suspicious).length,
    latestOdometerKm: derived.length > 0 ? derived[derived.length - 1].odometerKm : null,
    lastFillDate: entries.reduce<string | null>((latest, e) => (latest && latest > e.date ? latest : e.date), null),
  };
}

/** Expense totals per category, largest first. */
export function totalsByCategory(expenses: Expense[]): { category: Expense["category"]; total: number }[] {
  const totals = new Map<Expense["category"], number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  return [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
