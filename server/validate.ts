import { BODY_TYPES, type BodyType } from "../src/lib/bodyType.ts";
import type {
  CatalogEntryInput,
  ExpenseCategory,
  ExpenseInput,
  FactoryConsumption,
  FuelEntryInput,
  FuelType,
  ReminderInput,
  ReminderKind,
  ServiceDetails,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client-chosen record id (see FuelEntryInput), or undefined to let the server pick one. */
function clientId(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
}

/** Fill-ups and expenses can't be dated in the future; one day of slack covers time zones. */
function dateError(value: unknown): string | null {
  if (typeof value !== "string" || !isRealDate(value)) return "Geçerli bir tarih girin.";
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return value > tomorrow ? "Tarih ileri bir gün olamaz." : null;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

/** A positive number no larger than `max` (absurd values would only break totals and charts). */
function positiveNumber(value: unknown, max = 1_000_000_000): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max ? value : null;
}

/** "2026-02-31" has the right shape but isn't a day; JavaScript would quietly roll it to March. */
function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
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

  if (b.bodyType != null && !BODY_TYPES.includes(b.bodyType as BodyType)) return { ok: false, error: "Geçersiz kasa tipi." };

  return {
    ok: true,
    value: {
      name,
      bodyType: b.bodyType == null ? undefined : (b.bodyType as BodyType),
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
  const badDate = dateError(b.date);
  if (badDate) return { ok: false, error: badDate };

  // The odometer reading is optional; when given it must be a positive number.
  const odometerKm = b.odometerKm == null ? null : positiveNumber(b.odometerKm, 5_000_000);
  const liters = positiveNumber(b.liters, 5_000);
  const totalCost = positiveNumber(b.totalCost, 10_000_000);
  if (b.odometerKm != null && odometerKm == null) return { ok: false, error: "Geçerli bir kilometre girin." };
  if (liters == null) return { ok: false, error: "Litre değeri girin." };
  if (totalCost == null) return { ok: false, error: "Tutar değeri girin." };

  let gaugeBefore: number | undefined;
  if (b.gaugeBefore != null) {
    if (typeof b.gaugeBefore !== "number" || !(b.gaugeBefore >= 0 && b.gaugeBefore <= 1)) {
      return { ok: false, error: "Gösterge değeri 0 ile 1 arasında olmalı." };
    }
    gaugeBefore = b.gaugeBefore;
  }

  if (b.fuel != null && b.fuel !== "benzin" && b.fuel !== "lpg") return { ok: false, error: "Geçersiz yakıt." };

  return {
    ok: true,
    value: {
      id: clientId(b.id),
      vehicleId: b.vehicleId,
      date: b.date as string,
      odometerKm,
      liters,
      pricePerLiter: positiveNumber(b.pricePerLiter, 100_000) ?? totalCost / liters,
      totalCost,
      isFull: typeof b.isFull === "boolean" ? b.isFull : null,
      gaugeBefore,
      fuel: b.fuel === "benzin" || b.fuel === "lpg" ? b.fuel : undefined,
      note: optionalString(b.note, 200),
    },
  };
}

const IMAGE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
/** Largest accepted photo, as base64 text (about 1.1 MB of image). */
const MAX_IMAGE_CHARS = 1_500_000;

/** A photo sent as a data URL: JPEG, PNG or WebP, within the size limit. */
export function parseImage(value: unknown): { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string; dataUrl: string } | null {
  if (typeof value !== "string" || value.length > MAX_IMAGE_CHARS + 40) return null;
  const m = IMAGE.exec(value);
  if (!m || m[2].length > MAX_IMAGE_CHARS) return null;
  return { mediaType: m[1] as "image/jpeg" | "image/png" | "image/webp", base64: m[2], dataUrl: value };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** A plausible email address, trimmed and lower-cased; null if it doesn't look like one. */
export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

function parseServiceDetails(value: unknown): ServiceDetails | undefined | null {
  if (value == null) return undefined;
  if (typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const details: ServiceDetails = {};
  const shop = optionalString(v.shop, 80);
  if (shop) details.shop = shop;
  if (v.km != null) {
    const km = positiveNumber(v.km, 5_000_000);
    if (km == null) return null;
    details.km = km;
  }
  if (v.items != null) {
    if (!Array.isArray(v.items) || v.items.length > 20) return null;
    const items = v.items.map((i) => optionalString(i, 60)).filter((i): i is string => Boolean(i));
    if (items.length) details.items = items;
  }
  return Object.keys(details).length ? details : undefined;
}

export function parseExpenseInput(body: unknown): Result<ExpenseInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.vehicleId !== "string" || !b.vehicleId) return { ok: false, error: "Araç seçilmedi." };
  const badDate = dateError(b.date);
  if (badDate) return { ok: false, error: badDate };
  const category = EXPENSE_CATEGORIES.find((c) => c === b.category);
  if (!category) return { ok: false, error: "Geçersiz masraf türü." };
  const amount = positiveNumber(b.amount, 100_000_000);
  if (amount == null) return { ok: false, error: "Tutar değeri girin." };
  const details = parseServiceDetails(b.details);
  if (details === null) return { ok: false, error: "Servis bilgileri geçersiz." };
  let photo: string | null | undefined;
  if (b.photo === null) photo = null;
  else if (b.photo !== undefined) {
    const image = parseImage(b.photo);
    if (!image) return { ok: false, error: "Fotoğraf JPEG, PNG ya da WebP olmalı ve 1 MB'ı geçmemeli." };
    photo = image.dataUrl;
  }

  return {
    ok: true,
    value: {
      id: clientId(b.id),
      vehicleId: b.vehicleId,
      date: b.date as string,
      category,
      amount,
      note: optionalString(b.note, 200),
      details,
      photo,
    },
  };
}

export function parseReminderInput(body: unknown): Result<ReminderInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.vehicleId !== "string" || !b.vehicleId) return { ok: false, error: "Araç seçilmedi." };
  const kind = REMINDER_KINDS.find((k) => k === b.kind);
  if (!kind) return { ok: false, error: "Geçersiz hatırlatma türü." };

  let dueDate: string | undefined;
  if (b.dueDate != null && b.dueDate !== "") {
    if (typeof b.dueDate !== "string" || !isRealDate(b.dueDate)) return { ok: false, error: "Geçerli bir tarih girin." };
    dueDate = b.dueDate;
  }
  const dueKm = b.dueKm == null ? undefined : positiveNumber(b.dueKm, 5_000_000);
  if (dueKm === null) return { ok: false, error: "Geçerli bir kilometre girin." };
  if (!dueDate && dueKm == null) return { ok: false, error: "Bir tarih veya kilometre girin." };

  let repeatMonths: number | undefined;
  if (b.repeatMonths != null) {
    if (typeof b.repeatMonths !== "number" || !Number.isInteger(b.repeatMonths) || b.repeatMonths < 1 || b.repeatMonths > 120) {
      return { ok: false, error: "Tekrar aralığı 1-120 ay olmalı." };
    }
    repeatMonths = b.repeatMonths;
  }
  const repeatKm = b.repeatKm == null ? undefined : positiveNumber(b.repeatKm, 1_000_000);
  if (repeatKm === null) return { ok: false, error: "Geçerli bir tekrar kilometresi girin." };

  return {
    ok: true,
    value: {
      id: clientId(b.id),
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

  // Manufacturer's combined consumption, at most one figure per fuel type of the entry.
  const factoryConsumption: FactoryConsumption[] = [];
  if (b.factoryConsumption != null) {
    if (!Array.isArray(b.factoryConsumption)) return { ok: false, error: "Fabrika tüketimi geçersiz." };
    for (const raw of b.factoryConsumption as Record<string, unknown>[]) {
      const fuelType = fuelTypes.find((f) => f === raw?.fuelType);
      const lPer100km = typeof raw?.lPer100km === "number" && raw.lPer100km >= 1 && raw.lPer100km <= 30 ? raw.lPer100km : null;
      const cycle = raw?.cycle === "NEDC" || raw?.cycle === "WLTP" ? raw.cycle : null;
      if (!fuelType || lPer100km == null || !cycle) {
        return { ok: false, error: "Fabrika tüketimi için yakıt tipi, 1-30 arası L/100km ve ölçüm türü (WLTP/NEDC) gerekli." };
      }
      if (factoryConsumption.some((f) => f.fuelType === fuelType)) continue;
      factoryConsumption.push({ fuelType, engine: optionalString(raw.engine, 60) ?? "", lPer100km, cycle });
    }
  }

  return {
    ok: true,
    value: {
      brand,
      model,
      generation,
      yearFrom,
      yearTo,
      fuelTypes,
      tankCapacity,
      lpgTankCapacity,
      note: optionalString(b.note, 200),
      factoryConsumption: factoryConsumption.length ? factoryConsumption : undefined,
    },
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
  if (typeof password !== "string" || password.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (password.length > 200) return "Şifre çok uzun.";
  return null;
}
