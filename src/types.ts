export type FuelType = "benzin" | "dizel" | "lpg" | "benzin-lpg" | "hibrit";

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  /** Short display name, e.g. "Aile arabası" */
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  fuelType: FuelType;
  createdAt: string;
}

/** Fields the client sends when creating or editing a vehicle; the server owns id and createdAt. */
export type VehicleInput = Omit<Vehicle, "id" | "createdAt">;

export interface FuelEntry {
  id: string;
  vehicleId: string;
  /** ISO date string, e.g. "2026-03-14" */
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  note?: string;
  /** Username of whoever entered the fill-up; null if that user was deleted. */
  createdBy: string | null;
  createdAt: string;
}

/** Fields the client sends when adding a fill-up; the server owns id, createdBy and createdAt. */
export type FuelEntryInput = Omit<FuelEntry, "id" | "createdBy" | "createdAt">;

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

export interface VehicleStats {
  fillCount: number;
  totalCost: number;
  totalLiters: number;
  avgPricePerLiter: number;
  thisMonthCost: number;
  thisMonthFillCount: number;
  /** Overall L/100km across all fill-ups with a known distance. */
  avgConsumptionPer100km: number | null;
  kmTracked: number;
  latestOdometerKm: number | null;
  lastFillDate: string | null;
}
