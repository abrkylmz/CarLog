import type { DerivedEntry, Expense, FuelEntry, MonthlySummary, VehicleStats } from "../types";

/**
 * Adds km-since-last-fill and L/100km to each entry, assuming full-to-full
 * fill-ups ordered by odometer reading (not by entry date, since typos in
 * date shouldn't break the distance math).
 */
export function withDerived(entries: FuelEntry[]): DerivedEntry[] {
  const byOdometer = [...entries].sort((a, b) => a.odometerKm - b.odometerKm);

  return byOdometer.map((entry, i) => {
    const prev = byOdometer[i - 1];
    const kmSinceLast = prev ? entry.odometerKm - prev.odometerKm : null;
    const consumptionPer100km =
      kmSinceLast && kmSinceLast > 0 ? (entry.liters / kmSinceLast) * 100 : null;
    return { ...entry, kmSinceLast, consumptionPer100km };
  });
}

export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/** Monthly totals, newest first; months with only non-fuel expenses are included too. */
export function groupByMonth(entries: FuelEntry[], expenses: Expense[] = []): MonthlySummary[] {
  const derived = withDerived(entries);
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
    const litersWithKnownDistance = sum(
      bucket.filter((e) => e.kmSinceLast != null && e.kmSinceLast > 0).map((e) => e.liters),
    );

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
      avgConsumptionPer100km: kmDriven > 0 ? (litersWithKnownDistance / kmDriven) * 100 : null,
    });
  }

  return summaries.sort((a, b) => (a.month < b.month ? 1 : -1));
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

export function vehicleStats(entries: FuelEntry[], expenses: Expense[] = []): VehicleStats {
  const derived = withDerived(entries);
  const currentMonth = monthKey(new Date().toISOString());
  const thisMonth = entries.filter((e) => monthKey(e.date) === currentMonth);
  const thisMonthExpenses = expenses.filter((e) => monthKey(e.date) === currentMonth);

  const totalCost = sum(entries.map((e) => e.totalCost));
  const totalLiters = sum(entries.map((e) => e.liters));
  const withDistance = derived.filter((e) => e.kmSinceLast != null && e.kmSinceLast > 0);
  const kmTracked = sum(withDistance.map((e) => e.kmSinceLast ?? 0));
  const litersWithKnownDistance = sum(withDistance.map((e) => e.liters));

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
    avgConsumptionPer100km: kmTracked > 0 ? (litersWithKnownDistance / kmTracked) * 100 : null,
    kmTracked,
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
