export interface FuelEntry {
  id: string;
  /** ISO date string, e.g. "2026-03-14" */
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  note?: string;
}

export interface DerivedEntry extends FuelEntry {
  /** km driven since the previous fill-up, by odometer order. Null for the first entry. */
  kmSinceLast: number | null;
  /** L/100km for the distance covered since the previous fill-up. Null when kmSinceLast is null or zero. */
  consumptionPer100km: number | null;
}

export interface MonthlySummary {
  /** "YYYY-MM" */
  month: string;
  totalCost: number;
  totalLiters: number;
  fillCount: number;
  avgPricePerLiter: number;
  kmDriven: number;
  avgConsumptionPer100km: number | null;
}
