import type { DerivedEntry, FuelEntry, MonthlySummary } from "../types";

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

export function groupByMonth(entries: FuelEntry[]): MonthlySummary[] {
  const derived = withDerived(entries);
  const byMonth = new Map<string, DerivedEntry[]>();

  for (const entry of derived) {
    const key = monthKey(entry.date);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(entry);
    byMonth.set(key, bucket);
  }

  const summaries: MonthlySummary[] = [];
  for (const [month, bucket] of byMonth) {
    const totalCost = sum(bucket.map((e) => e.totalCost));
    const totalLiters = sum(bucket.map((e) => e.liters));
    const kmDriven = sum(bucket.map((e) => e.kmSinceLast ?? 0));
    const litersWithKnownDistance = sum(
      bucket.filter((e) => e.kmSinceLast != null && e.kmSinceLast > 0).map((e) => e.liters),
    );

    summaries.push({
      month,
      totalCost,
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
