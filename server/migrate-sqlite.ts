// One-time copy from the old SQLite file (data/carlog.db) into Postgres.
// Target is DATABASE_URL (from .env.local) or, without it, the local PGlite database.
// Safe to re-run: rows that already exist are skipped. Sessions are not copied, so everyone signs in again.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databaseUrl, query, transaction, type Statement } from "./db.ts";

const source = process.argv[2] ?? join(import.meta.dirname, "..", "data", "carlog.db");
if (!existsSync(source)) {
  console.error(`Kaynak bulunamadı: ${source}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(source, { readOnly: true });
const all = (sql: string) => sqlite.prepare(sql).all() as Record<string, unknown>[];

const statements: Statement[] = [];
const users = all("SELECT * FROM users");
const vehicles = all("SELECT * FROM vehicles");
const entries = all("SELECT * FROM entries");

for (const u of users) {
  statements.push({
    text: `INSERT INTO users (id, username, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
    params: [u.id, u.username, u.password_hash, u.role, u.created_at],
  });
}
for (const v of vehicles) {
  statements.push({
    text: `INSERT INTO vehicles (id, name, brand, model, year, plate, fuel_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING id`,
    params: [v.id, v.name, v.brand, v.model, v.year, v.plate, v.fuel_type, v.created_at],
  });
}
for (const e of entries) {
  statements.push({
    text: `INSERT INTO entries (id, vehicle_id, date, odometer_km, liters, price_per_liter, total_cost, note, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING RETURNING id`,
    params: [
      e.id,
      e.vehicle_id,
      e.date,
      e.odometer_km,
      e.liters,
      e.price_per_liter,
      e.total_cost,
      e.note,
      e.created_by,
      e.created_at,
    ],
  });
}

console.log(`Hedef: ${databaseUrl() ? "Postgres (DATABASE_URL)" : "yerel PGlite (data/pglite)"}`);
await query("SELECT 1"); // creates the tables if needed
const results = statements.length > 0 ? await transaction(statements) : [];

const count = (from: number, to: number) => results.slice(from, to).filter((r) => r.length > 0).length;
const u = users.length;
const v = u + vehicles.length;
console.log(`Kullanıcı: ${count(0, u)}/${users.length} aktarıldı`);
console.log(`Araç:      ${count(u, v)}/${vehicles.length} aktarıldı`);
console.log(`Dolum:     ${count(v, results.length)}/${entries.length} aktarıldı`);
console.log("(Aktarılmayanlar hedefte zaten vardı.)");
process.exit(0);
