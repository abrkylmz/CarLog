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

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS;
const isoOfDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/**
 * km driven per month ("YYYY-MM" → km) for one vehicle, from its odometer readings. The distance
 * between two readings is spread evenly over the days between them, so a stretch from 25 January
 * to 10 February counts partly toward each month. Fill-ups without a reading are skipped, and so
 * are readings that don't move forward (a typo would otherwise produce negative km).
 */
export function monthlyKm(entries: FuelEntry[]): Map<string, number> {
  const readings = entries
    .filter((e): e is FuelEntry & { odometerKm: number } => e.odometerKm != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm);
  const km = new Map<string, number>();
  const add = (month: string, value: number) => km.set(month, (km.get(month) ?? 0) + value);

  let prev: (typeof readings)[number] | null = null;
  for (const r of readings) {
    if (prev && r.odometerKm > prev.odometerKm) {
      const distance = r.odometerKm - prev.odometerKm;
      const from = dayNumber(prev.date);
      const to = dayNumber(r.date);
      if (to <= from) {
        add(monthKey(r.date), distance);
      } else {
        // Each day after the previous reading up to this one gets an equal share.
        const perDay = distance / (to - from);
        for (let day = from + 1; day <= to; day++) add(monthKey(isoOfDay(day)), perDay);
      }
    }
    if (!prev || r.odometerKm > prev.odometerKm) prev = r;
  }
  return km;
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
    latestOdometerKm: derived.reduce<number | null>(
      (max, e) => (e.odometerKm != null && (max == null || e.odometerKm > max) ? e.odometerKm : max),
      null,
    ),
    lastFillDate: entries.reduce<string | null>((latest, e) => (latest && latest > e.date ? latest : e.date), null),
  };
}

/** Expense totals per category, largest first. */
export function totalsByCategory(expenses: Expense[]): { category: Expense["category"]; total: number }[] {
  const totals = new Map<Expense["category"], number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  return [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
