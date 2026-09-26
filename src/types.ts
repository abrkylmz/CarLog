export type FuelType = "benzin" | "dizel" | "lpg" | "benzin-lpg" | "hibrit";

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
}

/** A user's relation to a vehicle: the owner manages it, helpers add records to it. */
export type VehicleRole = "owner" | "helper";

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
  /** The signed-in user's role on this vehicle (set by the server on reads). */
  myRole?: VehicleRole;
  /** Username of the owner (set by the server on reads). */
  ownerName?: string | null;
}

/** Fields the client sends when creating or editing a vehicle; the server owns the rest. */
export type VehicleInput = Omit<Vehicle, "id" | "createdAt" | "myRole" | "ownerName">;

export interface VehicleMember {
  userId: string;
  username: string;
  role: VehicleRole;
  addedAt: string;
}

/** A shareable link that makes whoever opens it (after signing in) a helper on the vehicle. */
export interface VehicleInvite {
  id: string;
  createdAt: string;
  expiresAt: string;
  useCount: number;
  createdBy: string | null;
}

/** What an invite link shows before the visitor signs in. */
export interface InvitePreview {
  vehicleName: string;
  plate?: string;
  ownerName: string | null;
  expiresAt: string;
}

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
  /** Username of whoever entered it; null if that user was deleted. */
  createdBy: string | null;
  /** Id of whoever entered it; decides who may edit (the author or an admin). */
  createdById: string | null;
  createdAt: string;
  /** Set once the record has been edited. */
  updatedAt?: string;
  updatedBy?: string | null;
}

/** Fields the client sends when adding a fill-up; the server owns id, createdBy and createdAt. */
export type FuelEntryInput = Omit<FuelEntry, "id" | AuditField>;

export type ExpenseCategory =
  | "bakim"
  | "lastik"
  | "sigorta"
  | "vergi"
  | "muayene"
  | "otopark"
  | "otoyol"
  | "yikama"
  | "ceza"
  | "diger";

/** A non-fuel cost for a vehicle (service, insurance, tolls, ...). */
export interface Expense {
  id: string;
  vehicleId: string;
  /** ISO date string, e.g. "2026-03-14" */
  date: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  /** Username of whoever entered it; null if that user was deleted. */
  createdBy: string | null;
  /** Id of whoever entered it; decides who may edit (the author or an admin). */
  createdById: string | null;
  createdAt: string;
  /** Set once the record has been edited. */
  updatedAt?: string;
  updatedBy?: string | null;
}

/** Fields the client sends when adding an expense; the server owns id, createdBy and createdAt. */
export type ExpenseInput = Omit<Expense, "id" | AuditField>;

/** Server-owned bookkeeping fields on records. */
type AuditField = "createdBy" | "createdById" | "createdAt" | "updatedAt" | "updatedBy";

export type ReminderKind = "muayene" | "sigorta" | "kasko" | "bakim" | "vergi" | "lastik" | "egzoz" | "diger";

/** Something due for a vehicle by a date and/or an odometer reading, optionally repeating. */
export interface Reminder {
  id: string;
  vehicleId: string;
  kind: ReminderKind;
  /** Optional custom label; the kind's name is shown otherwise. */
  title?: string;
  /** ISO date, e.g. "2027-03-15" */
  dueDate?: string;
  dueKm?: number;
  /** When completed, the next reminder is due this many months / km later. */
  repeatMonths?: number;
  repeatKm?: number;
  note?: string;
  /** Set when completed; completed reminders stay for history. */
  doneAt?: string;
  doneBy?: string | null;
  createdBy: string | null;
  createdById: string | null;
  createdAt: string;
}

export type ReminderInput = Omit<Reminder, "id" | "doneAt" | "doneBy" | "createdBy" | "createdById" | "createdAt">;

export interface DerivedEntry extends FuelEntry {
  /** km driven since the previous fill-up, by odometer order. Null for the first entry. */
  kmSinceLast: number | null;
  /** L/100km for the distance covered since the previous fill-up. Null when kmSinceLast is null or zero. */
  consumptionPer100km: number | null;
}

export interface MonthlySummary {
  /** "YYYY-MM" */
  month: string;
  /** Fuel spend. */
  totalCost: number;
  /** Non-fuel expenses. */
  otherCost: number;
  /** Fuel + other expenses. */
  grandTotal: number;
  totalLiters: number;
  fillCount: number;
  avgPricePerLiter: number;
  kmDriven: number;
  avgConsumptionPer100km: number | null;
}

export interface VehicleStats {
  fillCount: number;
  /** Fuel spend; other expenses are the *OtherCost fields. */
  totalCost: number;
  totalLiters: number;
  avgPricePerLiter: number;
  thisMonthCost: number;
  thisMonthFillCount: number;
  otherCostTotal: number;
  thisMonthOtherCost: number;
  expenseCount: number;
  /** Overall L/100km across all fill-ups with a known distance. */
  avgConsumptionPer100km: number | null;
  kmTracked: number;
  latestOdometerKm: number | null;
  lastFillDate: string | null;
}
