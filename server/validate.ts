import type {
  CatalogEntryInput,
  ExpenseCategory,
  ExpenseInput,
  FuelEntryInput,
  FuelType,
  ReminderInput,
  ReminderKind,
  VehicleInput,
} from "../src/types.ts";

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

const REMINDER_KINDS: ReminderKind[] = ["muayene", "sigorta", "kasko", "bakim", "vergi", "lastik", "egzoz", "diger"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  let tankCapacity: number | undefined;
  if (b.tankCapacity != null) {
    if (typeof b.tankCapacity !== "number" || !(b.tankCapacity >= 5 && b.tankCapacity <= 300)) {
      return { ok: false, error: "Depo hacmi 5-300 litre arasında olmalı." };
    }
    tankCapacity = b.tankCapacity;
  }

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
      tankCapacity,
      catalogId: typeof b.catalogId === "string" && b.catalogId.length <= 80 ? b.catalogId : undefined,
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

  let gaugeBefore: number | undefined;
  if (b.gaugeBefore != null) {
    if (typeof b.gaugeBefore !== "number" || !(b.gaugeBefore >= 0 && b.gaugeBefore <= 1)) {
      return { ok: false, error: "Gösterge değeri 0 ile 1 arasında olmalı." };
    }
    gaugeBefore = b.gaugeBefore;
  }

  return {
    ok: true,
    value: {
      vehicleId: b.vehicleId,
      date: b.date,
      odometerKm,
      liters,
      pricePerLiter: positiveNumber(b.pricePerLiter) ?? totalCost / liters,
      totalCost,
      isFull: typeof b.isFull === "boolean" ? b.isFull : null,
      gaugeBefore,
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

export function parseReminderInput(body: unknown): Result<ReminderInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.vehicleId !== "string" || !b.vehicleId) return { ok: false, error: "Araç seçilmedi." };
  const kind = REMINDER_KINDS.find((k) => k === b.kind);
  if (!kind) return { ok: false, error: "Geçersiz hatırlatma türü." };

  let dueDate: string | undefined;
  if (b.dueDate != null && b.dueDate !== "") {
    if (typeof b.dueDate !== "string" || !ISO_DATE.test(b.dueDate)) return { ok: false, error: "Geçerli bir tarih girin." };
    dueDate = b.dueDate;
  }
  const dueKm = b.dueKm == null ? undefined : positiveNumber(b.dueKm);
  if (dueKm === null) return { ok: false, error: "Geçerli bir kilometre girin." };
  if (!dueDate && dueKm == null) return { ok: false, error: "Bir tarih veya kilometre girin." };

  let repeatMonths: number | undefined;
  if (b.repeatMonths != null) {
    if (typeof b.repeatMonths !== "number" || !Number.isInteger(b.repeatMonths) || b.repeatMonths < 1 || b.repeatMonths > 120) {
      return { ok: false, error: "Tekrar aralığı 1-120 ay olmalı." };
    }
    repeatMonths = b.repeatMonths;
  }
  const repeatKm = b.repeatKm == null ? undefined : positiveNumber(b.repeatKm);
  if (repeatKm === null) return { ok: false, error: "Geçerli bir tekrar kilometresi girin." };

  return {
    ok: true,
    value: {
      vehicleId: b.vehicleId,
      kind,
      title: optionalString(b.title, 60),
      dueDate,
      dueKm,
      repeatMonths,
      repeatKm,
      note: optionalString(b.note, 200),
    },
  };
}

export function parseCatalogInput(body: unknown): Result<CatalogEntryInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const brand = optionalString(b.brand, 40);
  const model = optionalString(b.model, 60);
  const generation = optionalString(b.generation, 60);
  if (!brand || !model || !generation) return { ok: false, error: "Marka, model ve nesil gerekli." };

  const year = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1950 && v <= 2100 ? v : null);
  const yearFrom = year(b.yearFrom);
  if (yearFrom == null) return { ok: false, error: "Geçerli bir başlangıç yılı girin." };
  let yearTo: number | undefined;
  if (b.yearTo != null) {
    const y = year(b.yearTo);
    if (y == null || y < yearFrom) return { ok: false, error: "Bitiş yılı başlangıçtan önce olamaz." };
    yearTo = y;
  }

  const fuelTypes = Array.isArray(b.fuelTypes) ? FUEL_TYPES.filter((f) => (b.fuelTypes as unknown[]).includes(f)) : [];
  if (fuelTypes.length === 0) return { ok: false, error: "En az bir yakıt tipi seçin." };

  const tank = (v: unknown) => (typeof v === "number" && v >= 5 && v <= 300 ? v : null);
  const tankCapacity = tank(b.tankCapacity);
  if (tankCapacity == null) return { ok: false, error: "Depo hacmi 5-300 litre arasında olmalı." };
  let lpgTankCapacity: number | undefined;
  if (b.lpgTankCapacity != null) {
    const l = tank(b.lpgTankCapacity);
    if (l == null) return { ok: false, error: "LPG tank hacmi 5-300 litre arasında olmalı." };
    lpgTankCapacity = l;
  }

  return {
    ok: true,
    value: { brand, model, generation, yearFrom, yearTo, fuelTypes, tankCapacity, lpgTankCapacity, note: optionalString(b.note, 200) },
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
