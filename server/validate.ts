import type { ExpenseCategory, ExpenseInput, FuelEntryInput, FuelType, VehicleInput } from "../src/types.ts";

const FUEL_TYPES: FuelType[] = ["benzin", "dizel", "lpg", "benzin-lpg", "hibrit"];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "bakim",
  "lastik",
  "sigorta",
  "vergi",
  "muayene",
  "otopark",
  "otoyol",
  "yikama",
  "ceza",
  "diger",
];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseVehicleInput(body: unknown): Result<VehicleInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = optionalString(b.name, 80);
  if (!name) return { ok: false, error: "Araç adı gerekli." };

  const fuelType = FUEL_TYPES.find((f) => f === b.fuelType);
  if (!fuelType) return { ok: false, error: "Geçersiz yakıt türü." };

  let year: number | undefined;
  if (b.year != null) {
    if (typeof b.year !== "number" || !Number.isInteger(b.year) || b.year < 1900 || b.year > 2100) {
      return { ok: false, error: "Geçerli bir model yılı girin." };
    }
    year = b.year;
  }

  return {
    ok: true,
    value: {
      name,
      brand: optionalString(b.brand, 60),
      model: optionalString(b.model, 60),
      year,
      plate: optionalString(b.plate, 20)?.toLocaleUpperCase("tr-TR"),
      fuelType,
    },
  };
}

export function parseEntryInput(body: unknown): Result<FuelEntryInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.vehicleId !== "string" || !b.vehicleId) return { ok: false, error: "Araç seçilmedi." };
  if (typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return { ok: false, error: "Geçerli bir tarih girin." };
  }

  const odometerKm = positiveNumber(b.odometerKm);
  const liters = positiveNumber(b.liters);
  const totalCost = positiveNumber(b.totalCost);
  if (odometerKm == null) return { ok: false, error: "Kilometre değeri girin." };
  if (liters == null) return { ok: false, error: "Litre değeri girin." };
  if (totalCost == null) return { ok: false, error: "Tutar değeri girin." };

  return {
    ok: true,
    value: {
      vehicleId: b.vehicleId,
      date: b.date,
      odometerKm,
      liters,
      pricePerLiter: positiveNumber(b.pricePerLiter) ?? totalCost / liters,
      totalCost,
      note: optionalString(b.note, 200),
    },
  };
}

export function parseExpenseInput(body: unknown): Result<ExpenseInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.vehicleId !== "string" || !b.vehicleId) return { ok: false, error: "Araç seçilmedi." };
  if (typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return { ok: false, error: "Geçerli bir tarih girin." };
  }
  const category = EXPENSE_CATEGORIES.find((c) => c === b.category);
  if (!category) return { ok: false, error: "Geçersiz masraf türü." };
  const amount = positiveNumber(b.amount);
  if (amount == null) return { ok: false, error: "Tutar değeri girin." };

  return {
    ok: true,
    value: { vehicleId: b.vehicleId, date: b.date, category, amount, note: optionalString(b.note, 200) },
  };
}

export function parseCredentials(body: unknown): Result<{ username: string; password: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    return {
      ok: false,
      error: "Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir.",
    };
  }
  const passwordError = checkPassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  return { ok: true, value: { username, password } };
}

export function checkPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 6) return "Şifre en az 6 karakter olmalı.";
  if (password.length > 200) return "Şifre çok uzun.";
  return null;
}
