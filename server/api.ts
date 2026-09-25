import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import type { ExpenseCategory, ExpenseInput, FuelEntryInput, ReminderKind, VehicleInput } from "../src/types.ts";
import {
  clearAttempts,
  createSession,
  destroySession,
  hashPassword,
  isThrottled,
  purgeExpired,
  recordAttempt,
  requireAdmin,
  requireUser,
  secretsMatch,
  verifyPassword,
} from "./auth.ts";
import {
  ENTRY_SELECT,
  EXPENSE_SELECT,
  insertEntryStatement,
  insertVehicleStatement,
  query,
  queryOne,
  REMINDER_SELECT,
  toEntry,
  toExpense,
  toReminder,
  toUser,
  toVehicle,
  transaction,
  type Row,
  type Statement,
} from "./db.ts";
import {
  checkPassword,
  parseCredentials,
  parseEntryInput,
  parseExpenseInput,
  parseReminderInput,
  parseVehicleInput,
} from "./validate.ts";

export const api = Router();

function paramId(req: Request): string {
  return String(req.params.id);
}

/**
 * Editing rule: admins may edit any record, users only what they entered themselves.
 * Returns an error response tuple, or null when the edit is allowed.
 */
async function checkEditable(
  req: Request,
  table: "entries" | "expenses" | "reminders",
): Promise<[number, string] | null> {
  const row = await queryOne(`SELECT created_by FROM ${table} WHERE id = $1`, [paramId(req)]);
  if (!row) return [404, "Kayıt bulunamadı."];
  if (req.user!.role !== "admin" && row.created_by !== req.user!.id) {
    return [403, "Yalnızca kendi eklediğiniz kayıtları düzenleyebilirsiniz."];
  }
  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adds months to an ISO date, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Where a completed reminder's cost is filed when the user enters one. */
const REMINDER_EXPENSE_CATEGORY: Record<ReminderKind, ExpenseCategory> = {
  muayene: "muayene",
  egzoz: "muayene",
  sigorta: "sigorta",
  kasko: "sigorta",
  bakim: "bakim",
  vergi: "vergi",
  lastik: "lastik",
  diger: "diger",
};

// ---- Auth ------------------------------------------------------------------

const TOO_MANY_ATTEMPTS = "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.";

async function adminExists(): Promise<boolean> {
  return (await queryOne("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")) != null;
}

/** Secret that must be entered to create the first admin; set in Vercel's environment variables. */
function adminSetupKey(): string | null {
  return process.env.ADMIN_SETUP_KEY?.trim() || null;
}

api.get("/auth/status", async (req, res) => {
  const hasAdmin = await adminExists();
  res.json({
    user: req.user ?? null,
    // Only the admin panel uses these, to offer first-admin setup.
    adminSetup: hasAdmin ? "done" : adminSetupKey() ? "available" : "needs-key",
  });
});

/** Creates the first admin, only with the ADMIN_SETUP_KEY secret and only while no admin exists. */
api.post("/auth/setup", async (req, res) => {
  const throttleKey = `setup:${req.ip ?? "unknown"}`;
  if (await isThrottled(throttleKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const expectedKey = adminSetupKey();
  if (!expectedKey) {
    return void res.status(403).json({ error: "Admin kurulumu kapalı: sunucuda ADMIN_SETUP_KEY tanımlı değil." });
  }
  const givenKey = typeof req.body?.setupKey === "string" ? req.body.setupKey.trim() : "";
  if (!secretsMatch(givenKey, expectedKey)) {
    await recordAttempt(throttleKey);
    return void res.status(403).json({ error: "Kurulum anahtarı hatalı." });
  }

  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  // The NOT EXISTS guard makes this a no-op once any admin exists.
  const row = await queryOne(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     SELECT $1::text, $2::text, $3::text, 'admin', $4::text
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [randomUUID(), parsed.value.username, await hashPassword(parsed.value.password), new Date().toISOString()],
  );
  if (!row) {
    return void res
      .status(409)
      .json({ error: (await adminExists()) ? "Admin hesabı zaten var." : "Bu kullanıcı adı zaten kullanılıyor." });
  }

  await createSession(res, row.id as string);
  res.status(201).json({ user: toUser(row) });
});

/** Public sign-up; always creates a regular user. */
api.post("/auth/register", async (req, res) => {
  const throttleKey = `register:${req.ip ?? "unknown"}`;
  if (await isThrottled(throttleKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const row = await queryOne(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     VALUES ($1, $2, $3, 'user', $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [randomUUID(), parsed.value.username, await hashPassword(parsed.value.password), new Date().toISOString()],
  );
  if (!row) return void res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." });

  await recordAttempt(throttleKey);
  await createSession(res, row.id as string);
  res.status(201).json({ user: toUser(row) });
});

/** `panel` keeps the two login screens apart: admins sign in only on the admin panel, users only on the main one. */
api.post("/auth/login", async (req, res) => {
  const throttleKey = `login:${req.ip ?? "unknown"}`;
  if (await isThrottled(throttleKey, 10)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const panel = req.body?.panel === "admin" ? "admin" : "user";
  const row = await queryOne("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);

  if (!row || !(await verifyPassword(password, row.password_hash as string))) {
    await recordAttempt(throttleKey);
    return void res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }
  if (panel === "admin" && row.role !== "admin") {
    return void res.status(403).json({ error: "Bu hesap yönetici değil. Kullanıcı girişini kullanın." });
  }
  if (panel === "user" && row.role === "admin") {
    return void res.status(403).json({ error: "Yönetici hesapları yönetici panelinden giriş yapar." });
  }

  await clearAttempts(throttleKey);
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

api.put("/entries/:id", requireUser, async (req, res) => {
  const denied = await checkEditable(req, "entries");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const parsed = parseEntryInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const e: FuelEntryInput = parsed.value;
  const row = await queryOne(
    `UPDATE entries SET vehicle_id = $1, date = $2, odometer_km = $3, liters = $4, price_per_liter = $5,
       total_cost = $6, note = $7, updated_at = $8, updated_by = $9
     WHERE id = $10 AND EXISTS (SELECT 1 FROM vehicles WHERE id = $1)
     RETURNING id`,
    [
      e.vehicleId,
      e.date,
      e.odometerKm,
      e.liters,
      e.pricePerLiter,
      e.totalCost,
      e.note ?? null,
      new Date().toISOString(),
      req.user!.id,
      paramId(req),
    ],
  );
  if (!row) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.json(toEntry((await queryOne(`${ENTRY_SELECT} WHERE e.id = $1`, [paramId(req)]))!));
});

api.delete("/entries/:id", requireAdmin, async (req, res) => {
  const row = await queryOne("DELETE FROM entries WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Kayıt bulunamadı." });
  res.status(204).end();
});

// ---- Other expenses (service, insurance, tolls, ...) --------------------------

api.get("/expenses", requireUser, async (_req, res) => {
  res.json((await query(`${EXPENSE_SELECT} ORDER BY x.date`)).map(toExpense));
});

api.post("/expenses", requireUser, async (req, res) => {
  const parsed = parseExpenseInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const input: ExpenseInput = parsed.value;
  const id = randomUUID();
  const rows = await query(
    `INSERT INTO expenses (id, vehicle_id, date, category, amount, note, created_by, created_at)
     SELECT $1::text, $2::text, $3::text, $4::text, $5::float8, $6::text, $7::text, $8::text
     WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = $2::text)
     RETURNING id`,
    [id, input.vehicleId, input.date, input.category, input.amount, input.note ?? null, req.user!.id, new Date().toISOString()],
  );
  if (rows.length === 0) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.status(201).json(toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [id]))!));
});

api.put("/expenses/:id", requireUser, async (req, res) => {
  const denied = await checkEditable(req, "expenses");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const parsed = parseExpenseInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const x: ExpenseInput = parsed.value;
  const row = await queryOne(
    `UPDATE expenses SET vehicle_id = $1, date = $2, category = $3, amount = $4, note = $5,
       updated_at = $6, updated_by = $7
     WHERE id = $8 AND EXISTS (SELECT 1 FROM vehicles WHERE id = $1)
     RETURNING id`,
    [x.vehicleId, x.date, x.category, x.amount, x.note ?? null, new Date().toISOString(), req.user!.id, paramId(req)],
  );
  if (!row) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.json(toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [paramId(req)]))!));
});

api.delete("/expenses/:id", requireAdmin, async (req, res) => {
  const row = await queryOne("DELETE FROM expenses WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Masraf bulunamadı." });
  res.status(204).end();
});

// ---- Reminders (inspection, insurance, service, ...) ---------------------------

api.get("/reminders", requireUser, async (_req, res) => {
  res.json((await query(`${REMINDER_SELECT} ORDER BY r.due_date NULLS LAST, r.due_km NULLS LAST`)).map(toReminder));
});

async function reminderResponse(id: string) {
  return toReminder((await queryOne(`${REMINDER_SELECT} WHERE r.id = $1`, [id]))!);
}

api.post("/reminders", requireUser, async (req, res) => {
  const parsed = parseReminderInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const r = parsed.value;
  const id = randomUUID();
  const rows = await query(
    `INSERT INTO reminders (id, vehicle_id, kind, title, due_date, due_km, repeat_months, repeat_km, note, created_by, created_at)
     SELECT $1::text, $2::text, $3::text, $4::text, $5::text, $6::float8, $7::int, $8::float8, $9::text, $10::text, $11::text
     WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = $2::text)
     RETURNING id`,
    [
      id,
      r.vehicleId,
      r.kind,
      r.title ?? null,
      r.dueDate ?? null,
      r.dueKm ?? null,
      r.repeatMonths ?? null,
      r.repeatKm ?? null,
      r.note ?? null,
      req.user!.id,
      new Date().toISOString(),
    ],
  );
  if (rows.length === 0) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.status(201).json(await reminderResponse(id));
});

api.put("/reminders/:id", requireUser, async (req, res) => {
  const denied = await checkEditable(req, "reminders");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const parsed = parseReminderInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const r = parsed.value;
  await query(
    `UPDATE reminders SET kind = $1, title = $2, due_date = $3, due_km = $4, repeat_months = $5, repeat_km = $6, note = $7
     WHERE id = $8`,
    [r.kind, r.title ?? null, r.dueDate ?? null, r.dueKm ?? null, r.repeatMonths ?? null, r.repeatKm ?? null, r.note ?? null, paramId(req)],
  );
  res.json(await reminderResponse(paramId(req)));
});

/**
 * Marks a reminder done. If it repeats, the next one is created; if an amount is
 * given, it's also recorded as an expense. All in one transaction.
 */
api.post("/reminders/:id/complete", requireUser, async (req, res) => {
  const reminder = await queryOne("SELECT * FROM reminders WHERE id = $1", [paramId(req)]);
  if (!reminder) return void res.status(404).json({ error: "Hatırlatma bulunamadı." });
  if (reminder.done_at) return void res.status(409).json({ error: "Bu hatırlatma zaten tamamlanmış." });

  let amount: number | null = null;
  if (req.body?.amount != null && req.body.amount !== "") {
    amount = typeof req.body.amount === "number" && Number.isFinite(req.body.amount) && req.body.amount > 0 ? req.body.amount : NaN;
    if (Number.isNaN(amount)) return void res.status(400).json({ error: "Geçerli bir tutar girin." });
  }

  const now = new Date().toISOString();
  const today = todayIso();
  const statements: Statement[] = [
    {
      text: "UPDATE reminders SET done_at = $1, done_by = $2 WHERE id = $3 AND done_at IS NULL RETURNING id",
      params: [now, req.user!.id, paramId(req)],
    },
  ];

  const repeatMonths = reminder.repeat_months == null ? null : Number(reminder.repeat_months);
  const repeatKm = reminder.repeat_km == null ? null : Number(reminder.repeat_km);
  let nextId: string | null = null;
  if (repeatMonths || repeatKm) {
    // Date schedules keep their rhythm (insurance renews on the same day); km schedules count from
    // the old target, or from the latest odometer reading when there wasn't one.
    const nextDate = repeatMonths ? addMonths((reminder.due_date as string | null) ?? today, repeatMonths) : null;
    let nextKm: number | null = null;
    if (repeatKm) {
      const base =
        reminder.due_km != null
          ? Number(reminder.due_km)
          : Number(
              (await queryOne("SELECT MAX(odometer_km) AS km FROM entries WHERE vehicle_id = $1", [reminder.vehicle_id]))
                ?.km ?? 0,
            );
      nextKm = base + repeatKm;
    }
    nextId = randomUUID();
    statements.push({
      text: `INSERT INTO reminders (id, vehicle_id, kind, title, due_date, due_km, repeat_months, repeat_km, note, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      params: [
        nextId,
        reminder.vehicle_id,
        reminder.kind,
        reminder.title,
        nextDate,
        nextKm,
        repeatMonths,
        repeatKm,
        reminder.note,
        reminder.created_by,
        now,
      ],
    });
  }

  let expenseId: string | null = null;
  if (amount != null) {
    expenseId = randomUUID();
    statements.push({
      text: `INSERT INTO expenses (id, vehicle_id, date, category, amount, note, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      params: [
        expenseId,
        reminder.vehicle_id,
        today,
        REMINDER_EXPENSE_CATEGORY[reminder.kind as ReminderKind] ?? "diger",
        amount,
        (reminder.title as string | null) ?? null,
        req.user!.id,
        now,
      ],
    });
  }

  const [updated] = await transaction(statements);
  if (updated.length === 0) return void res.status(409).json({ error: "Bu hatırlatma zaten tamamlanmış." });

  res.json({
    completed: await reminderResponse(paramId(req)),
    next: nextId ? await reminderResponse(nextId) : null,
    expense: expenseId ? toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [expenseId]))!) : null,
  });
});

api.delete("/reminders/:id", requireAdmin, async (req, res) => {
  const row = await queryOne("DELETE FROM reminders WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Hatırlatma bulunamadı." });
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
