import type { Expense, FuelEntry, Vehicle } from "../types";
import { analyzeConsumption } from "./consumption";
import { EXPENSE_CATEGORY_LABELS } from "./format";

/** Everything the year-in-review ("Yıl Özeti") stories show, for one calendar year. */
export interface YearSummary {
  year: number;
  /** True while the year is still running ("şimdiye kadar"). */
  inProgress: boolean;
  km: number;
  liters: number;
  fillCount: number;
  fuelCost: number;
  otherCost: number;
  total: number;
  /** Spend per day over the days covered so far. */
  perDay: number;
  /** Fuel + other per month, January first (12 values). */
  months: number[];
  busiestMonth: { index: number; total: number } | null;
  cheapestFill: { date: string; price: number; vehicle: string } | null;
  /** Lowest yearly average among vehicles with at least 300 measured km. */
  mostEfficient: { vehicle: string; per100km: number } | null;
  topCategory: { label: string; total: number } | null;
  /** Vehicle with the most km, only when there is more than one vehicle. */
  topVehicle: { name: string; km: number } | null;
  /** Full tanks the liters add up to (using each fill's vehicle tank, 50 L when unknown). */
  tanks: number;
  vehicleCount: number;
}

export const EARTH_KM = 40_075;
export const ISTANBUL_ANKARA_KM = 450;

/** The year to offer: the current one if it has any fill-up, otherwise the latest year with data. */
export function wrappedYear(entries: FuelEntry[], now = new Date()): number | null {
  if (entries.length === 0) return null;
  const current = now.getFullYear();
  if (entries.some((e) => e.date.startsWith(String(current)))) return current;
  return Math.max(...entries.map((e) => Number(e.date.slice(0, 4))));
}

export function yearSummary(
  year: number,
  vehicles: Vehicle[],
  entries: FuelEntry[],
  expenses: Expense[],
  now = new Date(),
): YearSummary {
  const y = String(year);
  const inYear = (date: string) => date.startsWith(y);
  const fills = entries.filter((e) => inYear(e.date));
  const costs = expenses.filter((x) => inYear(x.date));
  const byId = new Map(vehicles.map((v) => [v.id, v]));

  const months = Array.from({ length: 12 }, () => 0);
  for (const e of fills) months[Number(e.date.slice(5, 7)) - 1] += e.totalCost;
  for (const x of costs) months[Number(x.date.slice(5, 7)) - 1] += x.amount;

  const fuelCost = fills.reduce((t, e) => t + e.totalCost, 0);
  const otherCost = costs.reduce((t, x) => t + x.amount, 0);
  const total = fuelCost + otherCost;
  const inProgress = year === now.getFullYear();
  const start = new Date(year, 0, 1);
  const end = inProgress ? now : new Date(year, 11, 31);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  // km per vehicle: last reading of the year minus the last reading before it (or its first).
  let km = 0;
  let topVehicle: YearSummary["topVehicle"] = null;
  let mostEfficient: YearSummary["mostEfficient"] = null;
  for (const v of vehicles) {
    const own = entries.filter((e) => e.vehicleId === v.id);
    // km come from fill-ups with a reading only.
    const readings = own
      .filter((e): e is FuelEntry & { odometerKm: number } => e.odometerKm != null)
      .sort((a, b) => a.odometerKm - b.odometerKm);
    const ofYear = readings.filter((e) => inYear(e.date));
    if (!own.some((e) => inYear(e.date))) continue;
    const before = readings.filter((e) => e.date < `${y}-01-01`);
    const from = before.length ? before[before.length - 1].odometerKm : ofYear[0]?.odometerKm;
    const driven = ofYear.length && from != null ? Math.max(0, ofYear[ofYear.length - 1].odometerKm - from) : 0;
    km += driven;
    if (!topVehicle || driven > topVehicle.km) topVehicle = { name: v.name, km: driven };

    const segments = analyzeConsumption(own, v.tankCapacity).segments.filter(
      (s) => inYear(s.endDate) && !s.suspicious && s.kind !== "rough",
    );
    const segKm = segments.reduce((t, s) => t + s.km, 0);
    if (segKm >= 300) {
      const per100km = (segments.reduce((t, s) => t + s.liters, 0) / segKm) * 100;
      if (!mostEfficient || per100km < mostEfficient.per100km) mostEfficient = { vehicle: v.name, per100km };
    }
  }
  const vehicleCount = new Set(fills.map((e) => e.vehicleId)).size;

  const busiest = months.reduce<YearSummary["busiestMonth"]>(
    (best, value, index) => (value > 0 && (!best || value > best.total) ? { index, total: value } : best),
    null,
  );
  const cheapest = fills.filter((e) => e.pricePerLiter > 0).reduce<FuelEntry | null>((best, e) => (!best || e.pricePerLiter < best.pricePerLiter ? e : best), null);
  const byCategory = new Map<Expense["category"], number>();
  for (const x of costs) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount);
  const top = [...byCategory].sort((a, b) => b[1] - a[1])[0];

  return {
    year,
    inProgress,
    km,
    liters: fills.reduce((t, e) => t + e.liters, 0),
    fillCount: fills.length,
    fuelCost,
    otherCost,
    total,
    perDay: total / days,
    months,
    busiestMonth: busiest,
    cheapestFill: cheapest
      ? { date: cheapest.date, price: cheapest.pricePerLiter, vehicle: byId.get(cheapest.vehicleId)?.name ?? "" }
      : null,
    mostEfficient,
    topCategory: top ? { label: EXPENSE_CATEGORY_LABELS[top[0]], total: top[1] } : null,
    topVehicle: vehicleCount > 1 ? topVehicle : null,
    tanks: fills.reduce((t, e) => t + e.liters / (byId.get(e.vehicleId)?.tankCapacity || 50), 0),
    vehicleCount,
  };
}
