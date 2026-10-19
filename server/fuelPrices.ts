// Pump prices per city for the home screen's price card: read from Petrol Ofisi's public price
// list (one page, all 81 provinces; petrol, diesel and autogas, VAT included), kept in the
// database and refreshed at most every few hours, so the source sees one request now and then
// however many people open the app.
//
// The page isn't an official API. If its layout changes and reading fails, the last good prices
// stay on screen and the failure shows up in the admin's error log.
import { Router, type Request, type Response } from "express";
import type { CityFuelPrice, FuelPrices } from "../src/types.ts";
import { PROVINCES } from "../src/lib/provinces.ts";
import { requireUser } from "./auth.ts";
import { query, queryOne, toUser, transaction, type Row } from "./db.ts";

export const SOURCE = "Petrol Ofisi";
const DEFAULT_URL = "https://www.petrolofisi.com.tr/akaryakit-fiyatlari";
/** FUEL_PRICES_URL: another address for the same page (tests use a local stand-in); "disabled" turns reading off. */
const sourceUrl = () => process.env.FUEL_PRICES_URL || DEFAULT_URL;

/** Prices older than this are read again. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;
/** After a failed read, wait this long before trying again. */
const RETRY_AFTER_MS = 30 * 60 * 1000;
/** How long one instance may take to read before another may try. */
const CLAIM_MS = 2 * 60 * 1000;
/** A request waits at most this long for a refresh; otherwise it gets the prices already stored. */
const WAIT_MS = 8000;

export interface ParsedCity {
  code: string;
  name: string;
  benzin: number | null;
  motorin: number | null;
  lpg: number | null;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").trim();

/** "ANKARA" → "Ankara"; Istanbul's two sides keep their side: "İstanbul (Avrupa)". */
function cityName(code: string, sourceName: string): string {
  const plate = Number(code.slice(0, 3));
  const side = /\(([^)]+)\)/.exec(sourceName)?.[1];
  const base = PROVINCES[plate] ?? sourceName.toLocaleLowerCase("tr").replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase("tr"));
  return side ? `${base} (${side.toLocaleLowerCase("tr").replace(/^\S/, (c) => c.toLocaleUpperCase("tr"))})` : base;
}

const plausible = (n: number | null) => n == null || (Number.isFinite(n) && n > 5 && n < 1000);

/**
 * Reads Petrol Ofisi's price table: one row per city, columns named in the table head. Throws
 * when the page doesn't look like the price list any more (so stale prices aren't overwritten).
 */
export function parsePetrolOfisi(html: string): ParsedCity[] {
  const head = /<thead[\s\S]*?<\/thead>/i.exec(html)?.[0];
  if (!head) throw new Error("fiyat tablosu başlığı bulunamadı");
  const columns = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => decode(m[1]));
  const col = (re: RegExp) => columns.findIndex((c) => re.test(c));
  const at = { benzin: col(/kurşunsuz\s*95/i), motorin: col(/diesel|motorin/i), lpg: col(/otogaz|lpg/i) };
  if (at.benzin < 1 || at.motorin < 1 || at.lpg < 1) throw new Error(`beklenen sütunlar yok: ${columns.join(" | ")}`);

  const cities: ParsedCity[] = [];
  for (const row of html.matchAll(/<tr[^>]*data-disctrict-id="([^"]+)"[^>]*data-disctrict-name="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const price = (i: number) => {
      const m = /class="with-tax"[^>]*>\s*([\d.,]+)/.exec(cells[i] ?? "");
      return m ? Number(m[1].replace(",", ".")) : null;
    };
    const city = { code: row[1], name: cityName(row[1], decode(row[2])), benzin: price(at.benzin), motorin: price(at.motorin), lpg: price(at.lpg) };
    if (!plausible(city.benzin) || !plausible(city.motorin) || !plausible(city.lpg)) throw new Error(`anlamsız fiyat: ${JSON.stringify(city)}`);
    cities.push(city);
  }
  if (cities.length < 75) throw new Error(`yalnızca ${cities.length} şehir okunabildi`);
  if (cities.filter((c) => c.benzin != null && c.motorin != null).length < 75) throw new Error("çoğu şehirde fiyat yok");
  return cities;
}

async function logFailure(message: string) {
  console.error("fuel prices:", message);
  // Shown under Yönetim → Hata Kayıtları (loaded lazily: api.ts imports this module).
  const { recordError } = await import("./api.ts");
  await recordError("server", `Akaryakıt fiyatları okunamadı: ${message}`.slice(0, 500), null, sourceUrl(), null, null);
}

/**
 * Reads the source again when the stored prices are old. Instances agree through app_meta that
 * only one of them reads at a time; a failed read waits a while before the next try.
 */
export async function refreshIfStale(now = new Date()): Promise<void> {
  if (sourceUrl() === "disabled") return;
  const fetched = (await queryOne("SELECT value FROM app_meta WHERE key = 'fuel_prices_fetched_at'"))?.value as string | undefined;
  if (fetched && now.getTime() - Date.parse(fetched) < MAX_AGE_MS) return;

  // "Next attempt not before": claim it, or someone else is already on it (or it failed lately).
  const claimed = await queryOne(
    `INSERT INTO app_meta (key, value) VALUES ('fuel_prices_next_try', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE app_meta.value < $2
     RETURNING value`,
    [new Date(now.getTime() + CLAIM_MS).toISOString(), now.toISOString()],
  );
  if (!claimed) return;

  let cities: ParsedCity[];
  try {
    const res = await fetch(sourceUrl(), {
      // Header values must be plain ASCII.
      headers: { "User-Agent": "CarLog fuel price card (a few requests a day; https://carlog-theta.vercel.app)", Accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`kaynak ${res.status} döndü`);
    cities = parsePetrolOfisi(await res.text());
  } catch (err) {
    await query("UPDATE app_meta SET value = $1 WHERE key = 'fuel_prices_next_try'", [new Date(now.getTime() + RETRY_AFTER_MS).toISOString()]);
    await logFailure(err instanceof Error ? err.message : String(err));
    return;
  }

  const at = now.toISOString();
  await transaction([
    ...cities.map((c) => ({
      // A changed price keeps the one before it, so the card can show the latest rise or cut.
      text: `INSERT INTO fuel_prices (code, name, benzin, motorin, lpg, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (code) DO UPDATE SET
               prev_benzin  = CASE WHEN fuel_prices.benzin  IS DISTINCT FROM EXCLUDED.benzin  THEN fuel_prices.benzin  ELSE fuel_prices.prev_benzin  END,
               prev_motorin = CASE WHEN fuel_prices.motorin IS DISTINCT FROM EXCLUDED.motorin THEN fuel_prices.motorin ELSE fuel_prices.prev_motorin END,
               prev_lpg     = CASE WHEN fuel_prices.lpg     IS DISTINCT FROM EXCLUDED.lpg     THEN fuel_prices.lpg     ELSE fuel_prices.prev_lpg     END,
               changed_at   = CASE WHEN (fuel_prices.benzin, fuel_prices.motorin, fuel_prices.lpg) IS DISTINCT FROM (EXCLUDED.benzin, EXCLUDED.motorin, EXCLUDED.lpg)
                                   THEN EXCLUDED.updated_at ELSE fuel_prices.changed_at END,
               name = EXCLUDED.name, benzin = EXCLUDED.benzin, motorin = EXCLUDED.motorin, lpg = EXCLUDED.lpg, updated_at = EXCLUDED.updated_at`,
      params: [c.code, c.name, c.benzin, c.motorin, c.lpg, at],
    })),
    {
      text: `INSERT INTO app_meta (key, value) VALUES ('fuel_prices_fetched_at', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      params: [at],
    },
  ]);
}

const num = (v: unknown) => (v == null ? null : Number(v));

function toCity(row: Row): CityFuelPrice {
  const hasPrevious = row.prev_benzin != null || row.prev_motorin != null || row.prev_lpg != null;
  return {
    code: row.code as string,
    name: row.name as string,
    benzin: num(row.benzin),
    motorin: num(row.motorin),
    lpg: num(row.lpg),
    previous: hasPrevious ? { benzin: num(row.prev_benzin), motorin: num(row.prev_motorin), lpg: num(row.prev_lpg) } : null,
    changedAt: row.changed_at ? new Date(row.changed_at as string | Date).toISOString() : null,
  };
}

export const fuelPrices = Router();

/** All cities' prices (public figures, so no sign-in needed). */
fuelPrices.get("/fuel-prices", async (_req: Request, res: Response) => {
  // Wait briefly for a due refresh; a slow source never holds the card up for long.
  const refresh = refreshIfStale().catch((err) => logFailure(err instanceof Error ? err.message : String(err)));
  await Promise.race([refresh, new Promise((r) => setTimeout(r, WAIT_MS))]);
  const rows = await query("SELECT * FROM fuel_prices");
  const fetchedAt = ((await queryOne("SELECT value FROM app_meta WHERE key = 'fuel_prices_fetched_at'"))?.value as string | undefined) ?? null;
  const body: FuelPrices = {
    source: SOURCE,
    sourceUrl: DEFAULT_URL,
    fetchedAt,
    cities: rows.map(toCity).sort((a, b) => a.name.localeCompare(b.name, "tr")),
  };
  res.json(body);
});

/** The user's city for the card (null clears it). */
fuelPrices.put("/account/fuel-city", requireUser, async (req: Request, res: Response) => {
  const code = req.body?.code;
  if (code !== null && (typeof code !== "string" || !/^\d{5}$/.test(code))) return void res.status(400).json({ error: "Geçersiz şehir." });
  if (code && !(await queryOne("SELECT 1 FROM fuel_prices WHERE code = $1", [code]))) return void res.status(400).json({ error: "Bu şehrin fiyatı yok." });
  const row = await queryOne("UPDATE users SET fuel_city = $1 WHERE id = $2 RETURNING *", [code, req.user!.id]);
  res.json({ user: toUser(row!) });
});
