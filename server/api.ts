import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type {
  ExpenseCategory,
  ExpenseInput,
  FuelEntryInput,
  InvitePreview,
  ReminderKind,
  VehicleInput,
  VehicleInvite,
  VehicleMember,
  VehicleRole,
} from "../src/types.ts";
import {
  EDIT_OWN_ONLY,
  NOT_FOUND,
  OWNER_ONLY,
  recordAccess,
  VEHICLE_NOT_FOUND,
  vehicleRole,
  type RecordTable,
} from "./access.ts";
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
  accessibleVehicles,
  ENTRY_SELECT,
  EXPENSE_SELECT,
  insertEntryStatement,
  insertVehicleStatement,
  MY_VEHICLES_SELECT,
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
async function checkEditable(req: Request, table: RecordTable): Promise<[number, string] | null> {
  const access = await recordAccess(req, table, paramId(req));
  if (!access) return [404, NOT_FOUND];
  if (!access.canEdit) return [403, EDIT_OWN_ONLY];
  // Records stay on their vehicle; a vehicleId in the body is ignored.
  req.body = { ...req.body, vehicleId: access.vehicleId };
  return null;
}

async function checkDeletable(req: Request, table: RecordTable): Promise<[number, string] | null> {
  const access = await recordAccess(req, table, paramId(req));
  if (!access) return [404, NOT_FOUND];
  if (!access.canDelete) return [403, OWNER_ONLY];
  return null;
}

/** New records may only go to vehicles the caller is a member of. */
async function isMember(req: Request, vehicleId: string): Promise<boolean> {
  return (await vehicleRole(req.user!.id, vehicleId)) != null;
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

api.get("/vehicles", requireUser, async (req, res) => {
  res.json((await query(`${MY_VEHICLES_SELECT} ORDER BY v.created_at`, [req.user!.id])).map(toVehicle));
});

async function myVehicle(req: Request, vehicleId: string) {
  const row = await queryOne(`${MY_VEHICLES_SELECT} WHERE v.id = $2`, [req.user!.id, vehicleId]);
  return row ? toVehicle(row) : null;
}

/** Resolves the caller's role on :id and answers 404/403 unless it's at least `needed`. */
async function guardVehicle(req: Request, res: Response, needed: "member" | "owner"): Promise<boolean> {
  const role = await vehicleRole(req.user!.id, paramId(req));
  if (!role) {
    res.status(404).json({ error: VEHICLE_NOT_FOUND });
    return false;
  }
  if (needed === "owner" && role !== "owner") {
    res.status(403).json({ error: OWNER_ONLY });
    return false;
  }
  return true;
}

/** Whoever adds a vehicle becomes its owner. */
api.post("/vehicles", requireUser, async (req, res) => {
  const parsed = parseVehicleInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const vehicle = { ...parsed.value, id: randomUUID(), createdAt: new Date().toISOString() };
  await transaction([
    insertVehicleStatement(vehicle),
    {
      text: "INSERT INTO vehicle_members (vehicle_id, user_id, role, added_at) VALUES ($1, $2, 'owner', $3)",
      params: [vehicle.id, req.user!.id, vehicle.createdAt],
    },
  ]);
  res.status(201).json(await myVehicle(req, vehicle.id));
});

api.put("/vehicles/:id", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  const parsed = parseVehicleInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const v: VehicleInput = parsed.value;
  await query(
    `UPDATE vehicles SET name = $1, brand = $2, model = $3, year = $4, plate = $5, fuel_type = $6 WHERE id = $7`,
    [v.name, v.brand ?? null, v.model ?? null, v.year ?? null, v.plate ?? null, v.fuelType, paramId(req)],
  );
  res.json(await myVehicle(req, paramId(req)));
});

api.delete("/vehicles/:id", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  await query("DELETE FROM vehicles WHERE id = $1", [paramId(req)]);
  res.status(204).end();
});

// ---- Sharing: members and invite links ---------------------------------------

async function listMembers(vehicleId: string): Promise<VehicleMember[]> {
  const rows = await query(
    `SELECT m.user_id, u.username, m.role, m.added_at
     FROM vehicle_members m JOIN users u ON u.id = m.user_id
     WHERE m.vehicle_id = $1
     ORDER BY (m.role = 'owner') DESC, m.added_at`,
    [vehicleId],
  );
  return rows.map((r) => ({
    userId: r.user_id as string,
    username: r.username as string,
    role: r.role as VehicleRole,
    addedAt: r.added_at as string,
  }));
}

/** Any member may see who else has access; only the owner changes it. */
api.get("/vehicles/:id/members", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "member"))) return;
  res.json(await listMembers(paramId(req)));
});

/** Adds an existing account as a helper by username. */
api.post("/vehicles/:id/members", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const user = await queryOne("SELECT id FROM users WHERE lower(username) = lower($1)", [username]);
  if (!user) return void res.status(404).json({ error: "Bu kullanıcı adıyla bir hesap yok." });

  const added = await queryOne(
    `INSERT INTO vehicle_members (vehicle_id, user_id, role, added_at) VALUES ($1, $2, 'helper', $3)
     ON CONFLICT DO NOTHING RETURNING user_id`,
    [paramId(req), user.id, new Date().toISOString()],
  );
  if (!added) return void res.status(409).json({ error: "Bu kişinin araca zaten erişimi var." });
  res.status(201).json(await listMembers(paramId(req)));
});

/** The owner removes a helper, or a helper leaves the vehicle themselves. */
api.delete("/vehicles/:id/members/:userId", requireUser, async (req, res) => {
  const role = await vehicleRole(req.user!.id, paramId(req));
  if (!role) return void res.status(404).json({ error: VEHICLE_NOT_FOUND });
  const target = String(req.params.userId);
  const leaving = target === req.user!.id;
  if (leaving && role === "owner") {
    return void res.status(400).json({ error: "Araç sahibi paylaşımdan ayrılamaz; aracı silebilirsiniz." });
  }
  if (!leaving && role !== "owner") return void res.status(403).json({ error: OWNER_ONLY });

  const row = await queryOne(
    "DELETE FROM vehicle_members WHERE vehicle_id = $1 AND user_id = $2 AND role = 'helper' RETURNING user_id",
    [paramId(req), target],
  );
  if (!row) return void res.status(404).json({ error: "Bu kişi araçta yardımcı değil." });
  res.status(204).end();
});

const INVITE_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toInvite(row: Row): VehicleInvite {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    expiresAt: new Date(row.expires_at as string | Date).toISOString(),
    useCount: Number(row.use_count),
    createdBy: (row.created_by_name as string | null) ?? null,
  };
}

api.get("/vehicles/:id/invites", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  const rows = await query(
    `SELECT i.*, u.username AS created_by_name
     FROM vehicle_invites i LEFT JOIN users u ON u.id = i.created_by
     WHERE i.vehicle_id = $1 AND i.revoked_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [paramId(req)],
  );
  res.json(rows.map(toInvite));
});

/** Creates a link; the token is returned only now, since just its hash is stored. */
api.post("/vehicles/:id/invites", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  const token = randomBytes(24).toString("base64url");
  const id = randomUUID();
  await query(
    `INSERT INTO vehicle_invites (id, vehicle_id, token_hash, created_by, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval)`,
    [id, paramId(req), hashToken(token), req.user!.id, new Date().toISOString(), String(INVITE_TTL_DAYS)],
  );
  const row = await queryOne(
    `SELECT i.*, u.username AS created_by_name FROM vehicle_invites i LEFT JOIN users u ON u.id = i.created_by
     WHERE i.id = $1`,
    [id],
  );
  res.status(201).json({ invite: toInvite(row!), token });
});

api.delete("/vehicles/:id/invites/:inviteId", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  const row = await queryOne(
    "UPDATE vehicle_invites SET revoked_at = $1 WHERE id = $2 AND vehicle_id = $3 AND revoked_at IS NULL RETURNING id",
    [new Date().toISOString(), String(req.params.inviteId), paramId(req)],
  );
  if (!row) return void res.status(404).json({ error: "Davet bulunamadı." });
  res.status(204).end();
});

const INVALID_INVITE = "Bu davet linki geçersiz, iptal edilmiş veya süresi dolmuş.";

async function findInvite(token: string) {
  return queryOne(
    `SELECT i.id, i.vehicle_id, i.expires_at, v.name, v.plate, ou.username AS owner_name
     FROM vehicle_invites i
     JOIN vehicles v ON v.id = i.vehicle_id
     LEFT JOIN vehicle_members om ON om.vehicle_id = v.id AND om.role = 'owner'
     LEFT JOIN users ou ON ou.id = om.user_id
     WHERE i.token_hash = $1 AND i.revoked_at IS NULL AND i.expires_at > now()`,
    [hashToken(token)],
  );
}

/** Public: what the link is for, shown before the visitor signs in or registers. */
api.get("/invites/:token", async (req, res) => {
  const invite = await findInvite(String(req.params.token));
  if (!invite) return void res.status(404).json({ error: INVALID_INVITE });
  const preview: InvitePreview = {
    vehicleName: invite.name as string,
    plate: (invite.plate as string | null) ?? undefined,
    ownerName: (invite.owner_name as string | null) ?? null,
    expiresAt: new Date(invite.expires_at as string | Date).toISOString(),
  };
  res.json(preview);
});

api.post("/invites/:token/accept", requireUser, async (req, res) => {
  const invite = await findInvite(String(req.params.token));
  if (!invite) return void res.status(404).json({ error: INVALID_INVITE });
  const vehicleId = invite.vehicle_id as string;
  const existing = await vehicleRole(req.user!.id, vehicleId);
  if (existing) return void res.json({ vehicleId, alreadyMember: true });

  await transaction([
    {
      text: `INSERT INTO vehicle_members (vehicle_id, user_id, role, added_at) VALUES ($1, $2, 'helper', $3)
             ON CONFLICT DO NOTHING`,
      params: [vehicleId, req.user!.id, new Date().toISOString()],
    },
    { text: "UPDATE vehicle_invites SET use_count = use_count + 1 WHERE id = $1", params: [invite.id] },
  ]);
  res.json({ vehicleId, alreadyMember: false });
});

// ---- Fill-ups --------------------------------------------------------------

api.get("/entries", requireUser, async (req, res) => {
  res.json((await query(`${ENTRY_SELECT} WHERE ${accessibleVehicles("e", "$1")} ORDER BY e.date`, [req.user!.id])).map(toEntry));
});

api.post("/entries", requireUser, async (req, res) => {
  const parsed = parseEntryInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const input: FuelEntryInput = parsed.value;
  if (!(await isMember(req, input.vehicleId))) return void res.status(404).json({ error: VEHICLE_NOT_FOUND });
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

api.delete("/entries/:id", requireUser, async (req, res) => {
  const denied = await checkDeletable(req, "entries");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const row = await queryOne("DELETE FROM entries WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Kayıt bulunamadı." });
  res.status(204).end();
});

// ---- Other expenses (service, insurance, tolls, ...) --------------------------

api.get("/expenses", requireUser, async (req, res) => {
  res.json(
    (await query(`${EXPENSE_SELECT} WHERE ${accessibleVehicles("x", "$1")} ORDER BY x.date`, [req.user!.id])).map(toExpense),
  );
});

api.post("/expenses", requireUser, async (req, res) => {
  const parsed = parseExpenseInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const input: ExpenseInput = parsed.value;
  if (!(await isMember(req, input.vehicleId))) return void res.status(404).json({ error: VEHICLE_NOT_FOUND });
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

api.delete("/expenses/:id", requireUser, async (req, res) => {
  const denied = await checkDeletable(req, "expenses");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const row = await queryOne("DELETE FROM expenses WHERE id = $1 RETURNING id", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Masraf bulunamadı." });
  res.status(204).end();
});

// ---- Reminders (inspection, insurance, service, ...) ---------------------------

api.get("/reminders", requireUser, async (req, res) => {
  res.json(
    (
      await query(
        `${REMINDER_SELECT} WHERE ${accessibleVehicles("r", "$1")} ORDER BY r.due_date NULLS LAST, r.due_km NULLS LAST`,
        [req.user!.id],
      )
    ).map(toReminder),
  );
});

async function reminderResponse(id: string) {
  return toReminder((await queryOne(`${REMINDER_SELECT} WHERE r.id = $1`, [id]))!);
}

api.post("/reminders", requireUser, async (req, res) => {
  const parsed = parseReminderInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const r = parsed.value;
  if (!(await isMember(req, r.vehicleId))) return void res.status(404).json({ error: VEHICLE_NOT_FOUND });
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
  if (!(await recordAccess(req, "reminders", paramId(req)))) return void res.status(404).json({ error: NOT_FOUND });
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

api.delete("/reminders/:id", requireUser, async (req, res) => {
  const denied = await checkDeletable(req, "reminders");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
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

/**
 * Vehicles the deleted user owned pass to their longest-standing helper; vehicles without helpers
 * are deleted with their records. Without ?force=1 the API first answers 409 describing that.
 */
api.delete("/users/:id", requireAdmin, async (req, res) => {
  const userId = paramId(req);
  if (userId === req.user!.id) {
    return void res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  }
  if (!(await queryOne("SELECT 1 FROM users WHERE id = $1", [userId]))) {
    return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  }

  const owned = await query(
    `SELECT m.vehicle_id,
       (SELECT COUNT(*) FROM vehicle_members h WHERE h.vehicle_id = m.vehicle_id AND h.role = 'helper') AS helpers
     FROM vehicle_members m WHERE m.user_id = $1 AND m.role = 'owner'`,
    [userId],
  );
  const orphaned = owned.filter((o) => Number(o.helpers) === 0).length;
  const handedOver = owned.length - orphaned;
  if (owned.length > 0 && req.query.force !== "1") {
    const parts = [];
    if (handedOver) parts.push(`${handedOver} aracı yardımcılarından birine devredilecek`);
    if (orphaned) parts.push(`yardımcısı olmayan ${orphaned} aracı tüm kayıtlarıyla silinecek`);
    return void res.status(409).json({ error: `Bu kullanıcı ${owned.length} aracın sahibi: ${parts.join(", ")}.` });
  }

  const statements: Statement[] = [];
  for (const o of owned) {
    const vehicleId = o.vehicle_id as string;
    statements.push(
      { text: "DELETE FROM vehicle_members WHERE vehicle_id = $1 AND user_id = $2", params: [vehicleId, userId] },
      {
        text: `UPDATE vehicle_members SET role = 'owner'
               WHERE vehicle_id = $1 AND user_id = (
                 SELECT user_id FROM vehicle_members WHERE vehicle_id = $1 AND role = 'helper' ORDER BY added_at LIMIT 1
               )`,
        params: [vehicleId],
      },
      {
        text: "DELETE FROM vehicles WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM vehicle_members WHERE vehicle_id = $1)",
        params: [vehicleId],
      },
    );
  }
  statements.push({ text: "DELETE FROM users WHERE id = $1", params: [userId] });
  await transaction(statements);
  res.status(204).end();
});

// ---- One-time import of data saved in the browser before the server existed ----

api.post("/import", requireUser, async (req, res) => {
  const vehicles: unknown[] = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];
  const entries: unknown[] = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const now = new Date().toISOString();

  // Imported vehicles join the importer's garage; entries may only land on those or on vehicles
  // the importer already belongs to (an id that exists under someone else stays untouched).
  const payloadIds = vehicles.map((v) => (v as Record<string, unknown>)?.id).filter((id): id is string => typeof id === "string");
  const taken = new Set(
    (await query("SELECT id FROM vehicles WHERE id = ANY($1::text[])", [payloadIds])).map((r) => r.id as string),
  );
  const mine = new Set(
    (await query("SELECT vehicle_id FROM vehicle_members WHERE user_id = $1", [req.user!.id])).map((r) => r.vehicle_id as string),
  );

  const vehicleStatements: Statement[] = [];
  for (const raw of vehicles) {
    const r = raw as Record<string, unknown>;
    const parsed = parseVehicleInput(r);
    if (!parsed.ok || typeof r.id !== "string" || taken.has(r.id)) continue;
    vehicleStatements.push(
      insertVehicleStatement(
        { ...parsed.value, id: r.id, createdAt: typeof r.createdAt === "string" ? r.createdAt : now },
        { ignoreExisting: true },
      ),
    );
    mine.add(r.id);
  }
  const ownerStatements: Statement[] = [...mine]
    .filter((id) => payloadIds.includes(id) && !taken.has(id))
    .map((id) => ({
      text: "INSERT INTO vehicle_members (vehicle_id, user_id, role, added_at) VALUES ($1, $2, 'owner', $3) ON CONFLICT DO NOTHING",
      params: [id, req.user!.id, now],
    }));

  const entryStatements: Statement[] = [];
  for (const raw of entries) {
    const r = raw as Record<string, unknown>;
    const parsed = parseEntryInput(r);
    if (!parsed.ok || typeof r.id !== "string" || !mine.has(parsed.value.vehicleId)) continue;
    entryStatements.push(
      insertEntryStatement({ ...parsed.value, id: r.id, createdAt: now }, req.user!.id, { ignoreExisting: true }),
    );
  }

  if (vehicleStatements.length + entryStatements.length === 0) return void res.json({ vehicles: 0, entries: 0 });

  // Already-imported ids return no row, so they aren't counted.
  const results = await transaction([...vehicleStatements, ...ownerStatements, ...entryStatements]);
  const inserted = (rows: Row[][]) => rows.filter((r) => r.length > 0).length;
  res.json({
    vehicles: inserted(results.slice(0, vehicleStatements.length)),
    entries: inserted(results.slice(vehicleStatements.length + ownerStatements.length)),
  });
});
