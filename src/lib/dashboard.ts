import type { ConsumptionKind, ConsumptionSegment, Expense, FuelEntry, Vehicle } from "../types";
import { monthKey, monthlyKm } from "./calc";
import { analyzeConsumption, averageOf } from "./consumption";

// Figures for the home dashboard, across all of the user's vehicles.

/** Years that have any record, newest first; the current year is always offered. */
export function dataYears(entries: FuelEntry[], expenses: Expense[], now = new Date()): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const r of [...entries, ...expenses]) years.add(Number(r.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

const sum = (values: number[]) => values.reduce((t, v) => t + v, 0);
const inYear = (date: string, year: number) => date.startsWith(`${year}-`);

/** Percent change from `before` to `now`, or null when there is nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (!(before > 0)) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Every vehicle's measured stretches, each vehicle analysed on its own (its own tank, its own km). */
function allSegments(vehicles: Vehicle[], entries: FuelEntry[]): ConsumptionSegment[] {
  return vehicles.flatMap(
    (v) =>
      analyzeConsumption(
        entries.filter((e) => e.vehicleId === v.id),
        v.tankCapacity,
      ).segments,
  );
}

export interface Dashboard {
  year: number;
  fuelCost: number;
  otherCost: number;
  /** Vehicles with any fuel spend in the year. */
  vehiclesWithFuel: number;
  thisMonth: { total: number; change: number | null };
  consumption: { per100km: number | null; kind: ConsumptionKind | null; change: number | null };
  km: { total: number; change: number | null };
  /** Fuel spend per month of the year, January first. */
  monthlyFuel: number[];
}

export function dashboard(year: number, vehicles: Vehicle[], entries: FuelEntry[], expenses: Expense[], now = new Date()): Dashboard {
  const yearEntries = entries.filter((e) => inYear(e.date, year));

  // This month against the same days of last month, so a half-finished month isn't compared
  // with a whole one.
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const thisMonth = monthKey(today);
  const last = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)).toISOString().slice(0, 7);
  const day = today.slice(8, 10);
  const spend = (month: string, uptoDay: string) =>
    sum(entries.filter((e) => monthKey(e.date) === month && e.date.slice(8, 10) <= uptoDay).map((e) => e.totalCost)) +
    sum(expenses.filter((x) => monthKey(x.date) === month && x.date.slice(8, 10) <= uptoDay).map((x) => x.amount));

  const segments = allSegments(vehicles, entries);
  const avgFor = (y: number) => averageOf(segments.filter((s) => inYear(s.endDate, y)));
  const avg = avgFor(year);
  const prevAvg = avgFor(year - 1);

  const kmFor = (y: number) => {
    let total = 0;
    for (const v of vehicles) {
      for (const [month, km] of monthlyKm(entries.filter((e) => e.vehicleId === v.id))) {
        if (month.startsWith(`${y}-`)) total += km;
      }
    }
    return total;
  };
  const km = kmFor(year);

  const monthlyFuel = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return sum(yearEntries.filter((e) => monthKey(e.date) === key).map((e) => e.totalCost));
  });

  return {
    year,
    fuelCost: sum(yearEntries.map((e) => e.totalCost)),
    otherCost: sum(expenses.filter((x) => inYear(x.date, year)).map((x) => x.amount)),
    vehiclesWithFuel: new Set(yearEntries.map((e) => e.vehicleId)).size,
    thisMonth: { total: spend(thisMonth, "31"), change: change(spend(thisMonth, day), spend(last, day)) },
    consumption: {
      per100km: avg.per100km,
      kind: avg.kind,
      change: avg.per100km != null && prevAvg.per100km != null ? change(avg.per100km, prevAvg.per100km) : null,
    },
    km: { total: km, change: change(km, kmFor(year - 1)) },
    monthlyFuel,
  };
}

/** One vehicle's fuel + other spend for each of the last `months` months, oldest first. */
export function recentMonthlySpend(vehicleId: string, entries: FuelEntry[], expenses: Expense[], months = 12, now = new Date()): number[] {
  return Array.from({ length: months }, (_, i) => {
    const key = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)).toISOString().slice(0, 7);
    return (
      sum(entries.filter((e) => e.vehicleId === vehicleId && monthKey(e.date) === key).map((e) => e.totalCost)) +
      sum(expenses.filter((x) => x.vehicleId === vehicleId && monthKey(x.date) === key).map((x) => x.amount))
    );
  });
}
