import { join } from "node:path";
import type {
  Expense,
  ExpenseCategory,
  FuelEntry,
  FuelEntryInput,
  FuelType,
  Reminder,
  ReminderKind,
  Role,
  User,
  Vehicle,
} from "../src/types.ts";

export type Row = Record<string, unknown>;
export interface Statement {
  text: string;
  params?: unknown[];
}

interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  /** Runs the statements atomically and returns each one's rows. */
  transaction(statements: Statement[]): Promise<Row[][]>;
}

/**
 * Production (Vercel) talks to Neon Postgres over HTTP via DATABASE_URL.
 * Without it, local development uses an embedded Postgres (PGlite) stored in
 * data/pglite, so experiments never touch the live data.
 */
/** Vercel's Neon integration sets DATABASE_URL; older Vercel Postgres setups use POSTGRES_URL. */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

async function connect(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return {
      query: (text, params = []) => sql.query(text, params) as Promise<Row[]>,
      transaction: (statements) =>
        sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? []))) as Promise<Row[][]>,
    };
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL tanımlı değil. Vercel projesine bir Postgres veritabanı bağlayın.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.CARLOG_PGLITE_DIR ?? join(import.meta.dirname, "..", "data", "pglite");
  const pg = await PGlite.create(dir);
  return {
    query: async (text, params = []) => (await pg.query<Row>(text, params)).rows,
    transaction: (statements) =>
      pg.transaction(async (tx) => {
        const results: Row[][] = [];
        for (const s of statements) results.push((await tx.query<Row>(s.text, s.params ?? [])).rows);
        return results;
      }),
  };
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id            TEXT PRIMARY KEY,
     username      TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     role          TEXT NOT NULL CHECK (role IN ('admin', 'user')),
     created_at    TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username))`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token      TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TIMESTAMPTZ NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     brand      TEXT,
     model      TEXT,
     year       INTEGER,
     plate      TEXT,
     fuel_type  TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  // created_by is kept (not cascaded) when a user is deleted, so the history
  // still shows that someone else entered the fill-up.
  `CREATE TABLE IF NOT EXISTS entries (
     id              TEXT PRIMARY KEY,
     vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     date            TEXT NOT NULL,
     odometer_km     DOUBLE PRECISION NOT NULL,
     liters          DOUBLE PRECISION NOT NULL,
     price_per_liter DOUBLE PRECISION NOT NULL,
     total_cost      DOUBLE PRECISION NOT NULL,
     note            TEXT,
     created_by      TEXT,
     created_at      TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS entries_vehicle ON entries (vehicle_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
     id         TEXT PRIMARY KEY,
     vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     date       TEXT NOT NULL,
     category   TEXT NOT NULL,
     amount     DOUBLE PRECISION NOT NULL,
     note       TEXT,
     created_by TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS expenses_vehicle ON expenses (vehicle_id)`,
  // Edit tracking, added after the first release; IF NOT EXISTS keeps existing databases working.
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_at TEXT`,
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_by TEXT`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TEXT`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_by TEXT`,
  `CREATE TABLE IF NOT EXISTS reminders (
     id            TEXT PRIMARY KEY,
     vehicle_id    TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     kind          TEXT NOT NULL,
     title         TEXT,
     due_date      TEXT,
     due_km        DOUBLE PRECISION,
     repeat_months INTEGER,
     repeat_km     DOUBLE PRECISION,
     note          TEXT,
     done_at       TEXT,
     done_by       TEXT,
     created_by    TEXT,
     created_at    TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS reminders_vehicle ON reminders (vehicle_id)`,
  // Failed logins live in the database because serverless instances don't share memory.
  `CREATE TABLE IF NOT EXISTS login_attempts (
     ip       TEXT PRIMARY KEY,
     count    INTEGER NOT NULL,
     reset_at TIMESTAMPTZ NOT NULL
   )`,
];

let ready: Promise<Db> | null = null;

/** Connects and creates tables on first use; later calls reuse the same connection. */
function getDb(): Promise<Db> {
  ready ??= (async () => {
    const db = await connect();
    for (const statement of SCHEMA) await db.query(statement);
    return db;
  })().catch((err) => {
    ready = null; // let the next request retry instead of failing forever
    throw err;
  });
  return ready;
}

export async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await getDb()).query(text, params);
}

export async function queryOne(text: string, params: unknown[] = []): Promise<Row | undefined> {
  return (await query(text, params))[0];
}

export async function transaction(statements: Statement[]): Promise<Row[][]> {
  return (await getDb()).transaction(statements);
}

export function toUser(row: Row): User {
  return {
    id: row.id as string,
    username: row.username as string,
    role: row.role as Role,
    createdAt: row.created_at as string,
  };
}

export function toVehicle(row: Row): Vehicle {
  return {
    id: row.id as string,
    name: row.name as string,
    brand: (row.brand as string | null) ?? undefined,
    model: (row.model as string | null) ?? undefined,
    year: (row.year as number | null) ?? undefined,
    plate: (row.plate as string | null) ?? undefined,
    fuelType: row.fuel_type as FuelType,
    createdAt: row.created_at as string,
  };
}

export function toEntry(row: Row): FuelEntry {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    date: row.date as string,
    odometerKm: Number(row.odometer_km),
    liters: Number(row.liters),
    pricePerLiter: Number(row.price_per_liter),
    totalCost: Number(row.total_cost),
    note: (row.note as string | null) ?? undefined,
    ...audit(row),
  };
}

/** created/updated bookkeeping shared by fill-ups and expenses. */
function audit(row: Row) {
  return {
    createdBy: (row.created_by_name as string | null) ?? null,
    createdById: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? undefined,
    updatedBy: row.updated_at ? ((row.updated_by_name as string | null) ?? null) : undefined,
  };
}

export function toExpense(row: Row): Expense {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    date: row.date as string,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    note: (row.note as string | null) ?? undefined,
    ...audit(row),
  };
}

export function toReminder(row: Row): Reminder {
  const num = (v: unknown) => (v == null ? undefined : Number(v));
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    kind: row.kind as ReminderKind,
    title: (row.title as string | null) ?? undefined,
    dueDate: (row.due_date as string | null) ?? undefined,
    dueKm: num(row.due_km),
    repeatMonths: num(row.repeat_months),
    repeatKm: num(row.repeat_km),
    note: (row.note as string | null) ?? undefined,
    doneAt: (row.done_at as string | null) ?? undefined,
    doneBy: row.done_at ? ((row.done_by_name as string | null) ?? null) : undefined,
    createdBy: (row.created_by_name as string | null) ?? null,
    createdById: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export const REMINDER_SELECT = `
  SELECT r.*, cu.username AS created_by_name, du.username AS done_by_name
  FROM reminders r
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN users du ON du.id = r.done_by
`;

export const EXPENSE_SELECT = `
  SELECT x.*, u.username AS created_by_name, uu.username AS updated_by_name
  FROM expenses x
  LEFT JOIN users u ON u.id = x.created_by
  LEFT JOIN users uu ON uu.id = x.updated_by
`;

export const ENTRY_SELECT = `
  SELECT e.*, u.username AS created_by_name, uu.username AS updated_by_name
  FROM entries e
  LEFT JOIN users u ON u.id = e.created_by
  LEFT JOIN users uu ON uu.id = e.updated_by
`;

export function insertVehicleStatement(v: Vehicle, { ignoreExisting = false } = {}): Statement {
  return {
    text: `INSERT INTO vehicles (id, name, brand, model, year, plate, fuel_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ${ignoreExisting ? "ON CONFLICT (id) DO NOTHING" : ""}
           RETURNING id`,
    params: [v.id, v.name, v.brand ?? null, v.model ?? null, v.year ?? null, v.plate ?? null, v.fuelType, v.createdAt],
  };
}

/** Inserts only if the vehicle exists; with ignoreExisting, a duplicate id is skipped instead of failing. */
export function insertEntryStatement(
  e: FuelEntryInput & { id: string; createdAt: string },
  createdByUserId: string,
  { ignoreExisting = false } = {},
): Statement {
  return {
    text: `INSERT INTO entries (id, vehicle_id, date, odometer_km, liters, price_per_liter, total_cost, note, created_by, created_at)
           SELECT $1::text, $2::text, $3::text, $4::float8, $5::float8, $6::float8, $7::float8,
                  $8::text, $9::text, $10::text
           WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = $2::text)
           ${ignoreExisting ? "ON CONFLICT (id) DO NOTHING" : ""}
           RETURNING id`,
    params: [
      e.id,
      e.vehicleId,
      e.date,
      e.odometerKm,
      e.liters,
      e.pricePerLiter,
      e.totalCost,
      e.note ?? null,
      createdByUserId,
      e.createdAt,
    ],
  };
}
