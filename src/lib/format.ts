import type { ExpenseCategory, FuelType, Vehicle } from "../types";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

export function formatTL(value: number): string {
  return currency.format(value);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  return number.format(Number(value.toFixed(fractionDigits)));
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  benzin: "Benzin",
  dizel: "Dizel",
  lpg: "LPG",
  "benzin-lpg": "Benzin + LPG",
  hibrit: "Hibrit",
};

/** Order here is the order in the category picker. */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  bakim: "Bakım / Servis",
  lastik: "Lastik",
  sigorta: "Sigorta / Kasko",
  vergi: "Vergi (MTV)",
  muayene: "Muayene",
  otopark: "Otopark",
  otoyol: "Köprü / Otoyol",
  yikama: "Yıkama",
  ceza: "Trafik Cezası",
  diger: "Diğer",
};

/** "Toyota Corolla · 2019", or null when no details were entered. */
export function vehicleSubtitle(vehicle: Vehicle): string | null {
  const makeModel = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const parts = [makeModel, vehicle.year ? String(vehicle.year) : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
