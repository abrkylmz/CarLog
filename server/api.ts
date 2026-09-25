import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import type { FuelEntryInput, VehicleInput } from "../src/types.ts";
import {
  clearFailedLogins,
  createSession,
  destroySession,
  hashPassword,
  isLoginBlocked,
  purgeExpired,
  recordFailedLogin,
  requireAdmin,
  requireUser,
  verifyPassword,
} from "./auth.ts";
import {
  ENTRY_SELECT,
  insertEntryStatement,
  insertVehicleStatement,
  query,
  queryOne,
  toEntry,
  toUser,
  toVehicle,
  transaction,
  type Row,
  type Statement,
} from "./db.ts";
import { checkPassword, parseCredentials, parseEntryInput, parseVehicleInput } from "./validate.ts";

export const api = Router();

function paramId(req: Request): string {
  return String(req.params.id);
}

async function userCount(): Promise<number> {
  return Number((await queryOne("SELECT COUNT(*) AS n FROM users"))!.n);
}

// ---- Auth ------------------------------------------------------------------

api.get("/auth/status", async (req, res) => {
  res.json({ needsSetup: (await userCount()) === 0, user: req.user ?? null });
});

/** First-run only: creates the initial admin account. */
api.post("/auth/setup", async (req, res) => {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  // The NOT EXISTS guard makes this a no-op once any account exists.
  const row = await queryOne(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     SELECT $1::text, $2::text, $3::text, 'admin', $4::text
     WHERE NOT EXISTS (SELECT 1 FROM users)
     RETURNING *`,
    [randomUUID(), parsed.value.username, await hashPassword(parsed.value.password), new Date().toISOString()],
  );
  if (!row) return void res.status(409).json({ error: "Kurulum zaten tamamlanmış." });

  await createSession(res, row.id as string);
  res.status(201).json({ user: toUser(row) });
});

api.post("/auth/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (await isLoginBlocked(ip)) {
    return void res.status(429).json({ error: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin." });
  }

  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const row = await queryOne("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);

  if (!row || !(await verifyPassword(password, row.password_hash as string))) {
    await recordFailedLogin(ip);
    return void res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }

  await clearFailedLogins(ip);
  await purgeExpired();
  await createSession(res, row.id as string);
  res.json({ user: toUser(row) });
});

api.post("/auth/logout", async (req, res) => {
  await destroySession(req, res);
  res.status(204).end();
});

// ---- Vehicles --------------------------------------------------------------

api.get("/vehicles", requireUser, async (_req, res) => {
  res.json((await query("SELECT * FROM vehicles ORDER BY created_at")).map(toVehicle));
});

api.post("/vehicles", requireUser, async (req, res) => {
  const parsed = parseVehicleInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const vehicle = { ...parsed.value, id: randomUUID(), createdAt: new Date().toISOString() };
  const statement = insertVehicleStatement(vehicle);
  await query(statement.text, statement.params);
  res.status(201).json(vehicle);
});

api.put("/vehicles/:id", requireUser, async (req, res) => {
  const parsed = parseVehicleInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const v: VehicleInput = parsed.value;
  const row = await queryOne(
    `UPDATE vehicles SET name = $1, brand = $2, model = $3, year = $4, plate = $5, fuel_type = $6
     WHERE id = $7 RETURNING *`,
    [v.name, v.brand ?? null, v.model ?? null, v.year ?? null, v.plate ?? null, v.fuelType, paramId(req)],
  );
  if (!row) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.json(toVehicle(row));
});

api.delete("/vehicles/:id", requireAdmin, async (req, res) => {
  const row = await queryOne("DELETE FROM vehicles WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.status(204).end();
});

// ---- Fill-ups --------------------------------------------------------------

api.get("/entries", requireUser, async (_req, res) => {
  res.json((await query(`${ENTRY_SELECT} ORDER BY e.date`)).map(toEntry));
});

api.post("/entries", requireUser, async (req, res) => {
  const parsed = parseEntryInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const input: FuelEntryInput = parsed.value;
  const id = randomUUID();
  const statement = insertEntryStatement({ ...input, id, createdAt: new Date().toISOString() }, req.user!.id);
  if ((await query(statement.text, statement.params)).length === 0) {
    return void res.status(404).json({ error: "Araç bulunamadı." });
  }
  res.status(201).json(toEntry((await queryOne(`${ENTRY_SELECT} WHERE e.id = $1`, [id]))!));
});

api.delete("/entries/:id", requireAdmin, async (req, res) => {
  const row = await queryOne("DELETE FROM entries WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Kayıt bulunamadı." });
  res.status(204).end();
});

// ---- Users (admin) ---------------------------------------------------------

api.get("/users", requireAdmin, async (_req, res) => {
  res.json((await query("SELECT * FROM users ORDER BY created_at")).map(toUser));
});

api.post("/users", requireAdmin, async (req, res) => {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });
  const role = req.body?.role === "admin" ? "admin" : "user";

  const row = await queryOne(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [randomUUID(), parsed.value.username, await hashPassword(parsed.value.password), role, new Date().toISOString()],
  );
  if (!row) return void res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." });
  res.status(201).json(toUser(row));
});

api.put("/users/:id/password", requireAdmin, async (req, res) => {
  const error = checkPassword(req.body?.password);
  if (error) return void res.status(400).json({ error });

  const [updated] = await transaction([
    {
      text: "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
      params: [await hashPassword(req.body.password), paramId(req)],
    },
    // Sign the user out everywhere so the old password stops working immediately.
    { text: "DELETE FROM sessions WHERE user_id = $1", params: [paramId(req)] },
  ]);
  if (updated.length === 0) return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  res.status(204).end();
});

api.delete("/users/:id", requireAdmin, async (req, res) => {
  if (paramId(req) === req.user!.id) {
    return void res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  }
  const row = await queryOne("DELETE FROM users WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  res.status(204).end();
});

// ---- One-time import of data saved in the browser before the server existed ----

api.post("/import", requireAdmin, async (req, res) => {
  const vehicles: unknown[] = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];
  const entries: unknown[] = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const now = new Date().toISOString();

  const vehicleStatements: Statement[] = [];
  for (const raw of vehicles) {
    const r = raw as Record<string, unknown>;
    const parsed = parseVehicleInput(r);
    if (!parsed.ok || typeof r.id !== "string") continue;
    vehicleStatements.push(
      insertVehicleStatement(
        { ...parsed.value, id: r.id, createdAt: typeof r.createdAt === "string" ? r.createdAt : now },
        { ignoreExisting: true },
      ),
    );
  }

  const entryStatements: Statement[] = [];
  for (const raw of entries) {
    const r = raw as Record<string, unknown>;
    const parsed = parseEntryInput(r);
    if (!parsed.ok || typeof r.id !== "string") continue;
    entryStatements.push(
      insertEntryStatement({ ...parsed.value, id: r.id, createdAt: now }, req.user!.id, { ignoreExisting: true }),
    );
  }

  if (vehicleStatements.length + entryStatements.length === 0) return void res.json({ vehicles: 0, entries: 0 });

  // Already-imported ids and entries without a known vehicle return no row, so they aren't counted.
  const results = await transaction([...vehicleStatements, ...entryStatements]);
  const inserted = (rows: Row[][]) => rows.filter((r) => r.length > 0).length;
  res.json({
    vehicles: inserted(results.slice(0, vehicleStatements.length)),
    entries: inserted(results.slice(vehicleStatements.length)),
  });
});
