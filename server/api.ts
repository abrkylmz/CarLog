import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type {
  ExpenseCategory,
  ExpenseInput,
  FuelEntryInput,
  InvitePreview,
  ReminderKind,
  SupportMessage,
  SupportStatus,
  SupportThread,
  VehicleInput,
  VehicleInvite,
  VehicleMember,
  VehicleRole,
} from "../src/types.ts";
import {
  DELETE_OWN_ONLY,
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
  SESSION_COOKIE,
  currentSessionKey,
  destroySession,
  hashPassword,
  isThrottled,
  overLimit,
  purgeExpired,
  recordAttempt,
  requireAdmin,
  requireStaff,
  requireUser,
  secretsMatch,
  verifyLogin,
} from "./auth.ts";
import {
  accessibleVehicles,
  catalogUpsert,
  ENTRY_SELECT,
  EXPENSE_SELECT,
  insertEntryStatement,
  insertVehicleStatement,
  MY_VEHICLES_SELECT,
  query,
  queryOne,
  REMINDER_SELECT,
  toCatalogEntry,
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
  parseCatalogInput,
  parseCredentials,
  parseEntryInput,
  parseExpenseInput,
  parseReminderInput,
  parseVehicleInput,
  parseEmail,
  parseImage,
} from "./validate.ts";
import { sendReminderNotifications, sendToUser, vapidKeys } from "./push.ts";
import { PLAN_PREVIEW, PLANS, userHasFeature, vehicleLimit, type PlanId } from "../src/lib/plans.ts";
import { appUrl, mailConfigured, sendMail } from "./mail.ts";
import { readReceipt, receiptScanConfigured } from "./receipt.ts";
import { fuelPrices } from "./fuelPrices.ts";
import { sendMonthlySummaries } from "./push.ts";

export const api = Router();

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Stores an error for the admin's "Hatalar" tab, keeping the newest 1,000. Never throws. */
export async function recordError(
  source: "client" | "server",
  message: string,
  stack: string | null,
  url: string | null,
  userAgent: string | null,
  userId: string | null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO app_errors (id, source, message, stack, url, user_agent, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), source, message, stack, url, userAgent, userId],
    );
    if (Math.random() < 0.05) {
      await query(`DELETE FROM app_errors WHERE id NOT IN (SELECT id FROM app_errors ORDER BY created_at DESC LIMIT 1000)`);
    }
  } catch {
    // Error reporting must never cause an error of its own.
  }
}

const TOO_MANY_REQUESTS = "Çok fazla istek gönderildi. Biraz sonra tekrar deneyin.";

/** Answers 429 once `key` has been used more than `max` times in 15 minutes. */
async function limited(res: Response, key: string, max: number): Promise<boolean> {
  if (!(await overLimit(key, max))) return false;
  res.status(429).json({ error: TOO_MANY_REQUESTS });
  return true;
}

// Every signed-in change counts toward a per-account ceiling, so one account can't flood the
// database. Generous enough for sending a long offline queue at once.
api.use(async (req, res, next) => {
  if (req.method !== "GET" && req.user && (await limited(res, `write:${req.user.id}`, 300))) return;
  next();
});

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
  if (!access.canDelete) return [403, DELETE_OWN_ONLY];
  return null;
}

/**
 * A create sent again (the offline queue after a lost response) carries the id the client chose
 * the first time. "new": go ahead; "same": that record is already saved, by this user; "taken":
 * the id belongs to something else.
 */
async function priorCreate(table: RecordTable, id: string | undefined, userId: string): Promise<"new" | "same" | "taken"> {
  if (!id) return "new";
  const row = await queryOne(`SELECT created_by FROM ${table} WHERE id = $1`, [id]);
  if (!row) return "new";
  return row.created_by === userId ? "same" : "taken";
}
const ID_TAKEN = "Bu kayıt kimliği zaten kullanılıyor.";

/** Highest known odometer of a vehicle: its fill-ups or a reading typed in without one. */
async function latestKm(vehicleId: string): Promise<number | null> {
  const row = await queryOne(
    `SELECT GREATEST((SELECT MAX(odometer_km) FROM entries WHERE vehicle_id = $1), (SELECT odometer_km FROM vehicles WHERE id = $1)) AS km`,
    [vehicleId],
  );
  return row?.km == null ? null : Number(row.km);
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
    // Optional services that need keys on the server; the app hides what isn't set up.
    services: { receiptScan: receiptScanConfigured(), mail: mailConfigured() },
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
  // Every try counts too, taken usernames included, so sign-up can't be used to list accounts.
  if (await overLimit(`register-try:${req.ip ?? "unknown"}`, 30)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });
  // KVKK: the privacy notice has to be acknowledged before an account exists.
  if (req.body?.acceptedPrivacy !== true) return void res.status(400).json({ error: "Devam etmek için aydınlatma metnini onaylayın." });
  let email: string | null = null;
  if (req.body?.email != null && req.body.email !== "") {
    email = parseEmail(req.body.email);
    if (!email) return void res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
    if (await queryOne("SELECT 1 FROM users WHERE lower(email) = $1", [email])) {
      return void res.status(409).json({ error: "Bu e-posta başka bir hesapta kayıtlı." });
    }
  }

  const now = new Date().toISOString();
  const row = await queryOne(
    `INSERT INTO users (id, username, password_hash, role, created_at, email, privacy_accepted_at)
     VALUES ($1, $2, $3, 'user', $4, $5, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [randomUUID(), parsed.value.username, await hashPassword(parsed.value.password), now, email],
  );
  if (!row) return void res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." });

  await recordAttempt(throttleKey);
  await createSession(res, row.id as string);
  res.status(201).json({ user: toUser(row) });
});

/** `panel` keeps the two login screens apart: admins sign in only on the admin panel, users only on the main one. */
api.post("/auth/login", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().slice(0, 64) : "";
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 200) : "";
  const panel = req.body?.panel === "admin" ? "admin" : "user";
  // Per address, and per account so that guesses spread over many addresses still stop.
  const throttleKey = `login:${req.ip ?? "unknown"}`;
  const accountKey = `login-user:${username.toLowerCase()}`;
  if ((await isThrottled(throttleKey, 10)) || (await isThrottled(accountKey, 20))) {
    return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  }

  const row = await queryOne("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
  if (!(await verifyLogin(password, (row?.password_hash as string | undefined) ?? null)) || !row) {
    await recordAttempt(throttleKey);
    await recordAttempt(accountKey);
    return void res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }
  if (panel === "admin" && row.role !== "admin" && row.role !== "moderator") {
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

/** Set, change or remove the account's email (used only for password resets); needs the password. */
api.put("/account/email", requireUser, async (req, res) => {
  const throttleKey = `password:${req.user!.id}`;
  if (await isThrottled(throttleKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 200) : "";
  const row = await queryOne("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  if (!row || !(await verifyLogin(password, row.password_hash as string))) {
    await recordAttempt(throttleKey);
    return void res.status(403).json({ error: "Şifre hatalı." });
  }
  let email: string | null = null;
  if (req.body?.email != null && req.body.email !== "") {
    email = parseEmail(req.body.email);
    if (!email) return void res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
    if (await queryOne("SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2", [email, req.user!.id])) {
      return void res.status(409).json({ error: "Bu e-posta başka bir hesapta kayıtlı." });
    }
  }
  const updated = await queryOne("UPDATE users SET email = $1 WHERE id = $2 RETURNING *", [email, req.user!.id]);
  res.json({ user: toUser(updated!) });
});

const RESET_TTL_MINUTES = 60;

/**
 * "Şifremi unuttum": emails a one-time link to the account's address. The answer is the same
 * whether or not the account (or an email on it) exists, so it can't be used to look accounts up.
 */
api.post("/auth/forgot", async (req, res) => {
  if (!mailConfigured()) return void res.status(503).json({ error: "E-posta gönderimi henüz ayarlanmadı; şifrenizi yöneticiye sıfırlatabilirsiniz." });
  const ipKey = `forgot:${req.ip ?? "unknown"}`;
  if (await overLimit(ipKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  const login = typeof req.body?.login === "string" ? req.body.login.trim().slice(0, 254) : "";
  const done = () => res.json({ ok: true, message: "Hesapta kayıtlı bir e-posta varsa, şifre sıfırlama bağlantısı gönderildi." });
  if (!login) return void done();
  const user = await queryOne("SELECT id, username, email FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1)", [login]);
  if (!user?.email || (await overLimit(`forgot-user:${user.id}`, 3))) return void done();

  const token = randomBytes(32).toString("base64url");
  await query(`DELETE FROM password_resets WHERE user_id = $1 OR expires_at <= now()`, [user.id]);
  await query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`, [
    hashToken(token),
    user.id,
    String(RESET_TTL_MINUTES),
  ]);
  const link = `${appUrl()}/#/sifre-sifirla/${token}`;
  try {
    await sendMail(
      String(user.email),
      "CarLog şifre sıfırlama",
      `Merhaba ${user.username},\n\nCarLog şifrenizi sıfırlamak için bu bağlantıyı açın (${RESET_TTL_MINUTES} dakika geçerli, bir kez kullanılır):\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.`,
      `<p>Merhaba ${escapeHtml(String(user.username))},</p><p>CarLog şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın. Bağlantı ${RESET_TTL_MINUTES} dakika geçerlidir ve bir kez kullanılır.</p><p><a href="${link}">Şifremi sıfırla</a></p><p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>`,
    );
  } catch (err) {
    console.error(err);
  }
  done();
});

/** Sets a new password from a reset link; every session of the account is signed out. */
api.post("/auth/reset", async (req, res) => {
  if (await overLimit(`reset:${req.ip ?? "unknown"}`, 10)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  const token = typeof req.body?.token === "string" ? req.body.token.slice(0, 100) : "";
  const error = checkPassword(req.body?.password);
  if (error) return void res.status(400).json({ error });
  const row = await queryOne(`DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > now() RETURNING user_id`, [hashToken(token)]);
  if (!row) return void res.status(400).json({ error: "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin." });
  await transaction([
    { text: "UPDATE users SET password_hash = $1 WHERE id = $2", params: [await hashPassword(req.body.password), row.user_id] },
    { text: "DELETE FROM sessions WHERE user_id = $1", params: [row.user_id] },
    { text: "DELETE FROM password_resets WHERE user_id = $1", params: [row.user_id] },
  ]);
  res.status(204).end();
});

/**
 * "Fiş Tara": reads a receipt photo and returns the fill-up fields for the user to check. The
 * photo goes to Anthropic for reading and isn't stored. Part of the Pro plan (admins: always).
 */
api.post("/receipts/scan", requireUser, async (req, res) => {
  if (!receiptScanConfigured()) return void res.status(503).json({ error: "Fiş okuma henüz ayarlanmadı." });
  if (!userHasFeature(req.user!, "receiptScan")) return void res.status(403).json({ error: "Fiş okuma Pro ve üstü paketlerde var.", code: "plan_feature" });
  if (await limited(res, `receipt:${req.user!.id}`, 20)) return;
  const image = parseImage(req.body?.image);
  if (!image) return void res.status(400).json({ error: "Fotoğraf JPEG, PNG ya da WebP olmalı ve 1 MB'ı geçmemeli." });
  try {
    const reading = await readReceipt(image.mediaType, image.base64);
    if (!reading || !reading.is_fuel_receipt) return void res.status(422).json({ error: "Bu fotoğrafta bir akaryakıt fişi okunamadı." });
    res.json(reading);
  } catch (err) {
    console.error("receipt scan failed", err);
    res.status(502).json({ error: "Fiş şu an okunamadı. Biraz sonra tekrar deneyin ya da elle girin." });
  }
});

/**
 * Errors from users' browsers (and the server's own, see app.ts), for the admin's "Hatalar" tab.
 * Open to signed-out visitors too (the login screen can fail), but limited and size-capped.
 */
api.post("/errors", async (req, res) => {
  if (await overLimit(`errors:${req.ip ?? "unknown"}`, 20)) return void res.status(204).end();
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
  const message = text(req.body?.message, 500);
  if (!message) return void res.status(204).end();
  await recordError("client", message, text(req.body?.stack, 4000), text(req.body?.url, 300), text(req.headers["user-agent"], 300), req.user?.id ?? null);
  res.status(204).end();
});

api.get("/admin/errors", requireStaff, async (_req, res) => {
  const rows = await query(
    `SELECT e.*, u.username FROM app_errors e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 200`,
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      at: new Date(r.created_at as string | Date).toISOString(),
      source: r.source,
      message: r.message,
      stack: r.stack,
      url: r.url,
      userAgent: r.user_agent,
      username: r.username ?? null,
    })),
  );
});

api.delete("/admin/errors", requireAdmin, async (_req, res) => {
  await query("DELETE FROM app_errors");
  res.status(204).end();
});

/** Signed-in users change their own password; other devices are signed out, this one stays. */
api.post("/auth/password", requireUser, async (req, res) => {
  const throttleKey = `password:${req.user!.id}`;
  if (await isThrottled(throttleKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword.slice(0, 200) : "";
  const next = req.body?.newPassword;
  const row = await queryOne("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  if (!row || !(await verifyLogin(current, row.password_hash as string))) {
    await recordAttempt(throttleKey);
    return void res.status(403).json({ error: "Mevcut şifre hatalı." });
  }
  const error = checkPassword(next);
  if (error) return void res.status(400).json({ error });
  if (next === current) return void res.status(400).json({ error: "Yeni şifre eskisiyle aynı olamaz." });

  await transaction([
    { text: "UPDATE users SET password_hash = $1 WHERE id = $2", params: [await hashPassword(next), req.user!.id] },
    { text: "DELETE FROM sessions WHERE user_id = $1 AND token <> $2", params: [req.user!.id, currentSessionKey(req) ?? ""] },
  ]);
  await clearAttempts(throttleKey);
  res.status(204).end();
});

/**
 * Choose a subscription plan. While PLAN_PREVIEW is on there is no payment provider, so the plan
 * switches on straight away and free of charge; with payments, this is where checkout would start.
 */
api.post("/account/plan", requireUser, async (req, res) => {
  const plan = PLANS.find((p) => p.id === req.body?.plan);
  if (!plan) return void res.status(400).json({ error: "Geçersiz paket." });
  if (!PLAN_PREVIEW && plan.monthlyPrice > 0) {
    return void res.status(402).json({ error: "Ödeme altyapısı henüz hazır değil." });
  }
  const row = await queryOne("UPDATE users SET plan = $1, plan_since = $2 WHERE id = $3 RETURNING *", [
    plan.id,
    new Date().toISOString(),
    req.user!.id,
  ]);
  res.json({ user: toUser(row!) });
});

/** The user's monthly spending target for the budget ring; null clears it. */
api.put("/account/budget", requireUser, async (req, res) => {
  const value = req.body?.monthlyBudget;
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10_000_000)) {
    return void res.status(400).json({ error: "Geçerli bir bütçe girin." });
  }
  const row = await queryOne("UPDATE users SET monthly_budget = $1 WHERE id = $2 RETURNING *", [value, req.user!.id]);
  res.json({ user: toUser(row!) });
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

/** Whoever adds a vehicle becomes its owner, within their plan's vehicle limit. */
api.post("/vehicles", requireUser, async (req, res) => {
  const parsed = parseVehicleInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  // Only vehicles the user owns count; ones shared with them don't. Vehicles already over the
  // limit (from before plans existed) are kept; only adding more needs a bigger plan.
  const limit = vehicleLimit(req.user!);
  const owned = await queryOne("SELECT COUNT(*) AS n FROM vehicle_members WHERE user_id = $1 AND role = 'owner'", [req.user!.id]);
  if (Number(owned?.n ?? 0) >= limit) {
    return void res.status(403).json({
      error: `Paketinizde en fazla ${limit} araç eklenebilir. Daha fazlası için paketinizi yükseltin.`,
      code: "plan_limit",
    });
  }

  const vehicle = {
    ...parsed.value,
    catalogId: await knownCatalogId(parsed.value.catalogId),
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
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
    `UPDATE vehicles SET name = $1, brand = $2, model = $3, year = $4, plate = $5, fuel_type = $6, tank_capacity = $7,
       catalog_id = $9, body_type = $10
     WHERE id = $8`,
    [
      v.name,
      v.brand ?? null,
      v.model ?? null,
      v.year ?? null,
      v.plate ?? null,
      v.fuelType,
      v.tankCapacity ?? null,
      paramId(req),
      (await knownCatalogId(v.catalogId)) ?? null,
      v.bodyType ?? null,
    ],
  );
  res.json(await myVehicle(req, paramId(req)));
});

/**
 * The current odometer typed in without a fill-up, so km-based reminders don't wait for the next
 * one. Any member may set it (whoever drives knows the km); it can't go below a recorded reading.
 */
api.put("/vehicles/:id/odometer", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "member"))) return;
  const km = req.body?.odometerKm;
  if (typeof km !== "number" || !Number.isFinite(km) || km <= 0 || km > 5_000_000) {
    return void res.status(400).json({ error: "Geçerli bir kilometre girin." });
  }
  const recorded = await queryOne("SELECT MAX(odometer_km) AS km FROM entries WHERE vehicle_id = $1", [paramId(req)]);
  if (recorded?.km != null && km < Number(recorded.km)) {
    return void res
      .status(400)
      .json({ error: `Kilometre, dolumlarda kayıtlı en yüksek değerden (${Number(recorded.km).toLocaleString("tr-TR")} km) küçük olamaz.` });
  }
  const today = new Date().toISOString().slice(0, 10);
  await query("UPDATE vehicles SET odometer_km = $1, odometer_at = $2 WHERE id = $3", [km, today, paramId(req)]);
  res.json(await myVehicle(req, paramId(req)));
});

api.delete("/vehicles/:id", requireUser, async (req, res) => {
  if (!(await guardVehicle(req, res, "owner"))) return;
  await query("DELETE FROM vehicles WHERE id = $1", [paramId(req)]);
  res.status(204).end();
});

// ---- Vehicle catalog -------------------------------------------------------

/** A catalog id the client sent, if it (still) exists; otherwise the vehicle counts as hand-entered. */
async function knownCatalogId(id: string | undefined): Promise<string | undefined> {
  if (!id) return undefined;
  return (await queryOne("SELECT 1 FROM vehicle_catalog WHERE id = $1", [id])) ? id : undefined;
}

api.get("/catalog", requireUser, async (_req, res) => {
  res.json((await query("SELECT * FROM vehicle_catalog ORDER BY brand, model, year_from")).map(toCatalogEntry));
});

function catalogId(input: { brand: string; model: string; generation: string }): string {
  const slug = (t: string) =>
    t
      .toLocaleLowerCase("tr-TR")
      .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `${slug(input.brand)}-${slug(input.model)}-${slug(input.generation)}-${randomUUID().slice(0, 6)}`;
}

api.post("/catalog", requireAdmin, async (req, res) => {
  const parsed = parseCatalogInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });
  const entry = { ...parsed.value, id: catalogId(parsed.value) };
  const statements: Statement[] = [catalogUpsert(entry)];
  // Added from the "missing" list: hand-entered vehicles of this make and model (in its years and
  // fuel types) join the new entry, so they leave that list for good. Only the link changes; the
  // owners' own details (tank size, plate, …) stay as they entered them.
  if (req.body?.linkVehicles === true) {
    statements.push({
      text: `UPDATE vehicles SET catalog_id = $1
             WHERE catalog_id IS NULL
               AND lower(trim(brand)) = lower(trim($2::text)) AND lower(trim(model)) = lower(trim($3::text))
               AND (year IS NULL OR (year >= $4::int AND year <= COALESCE($5::int, 9999)))
               AND fuel_type = ANY($6::text[])
             RETURNING id`,
      params: [entry.id, entry.brand, entry.model, entry.yearFrom, entry.yearTo ?? null, entry.fuelTypes],
    });
  }
  const [, linked = []] = await transaction(statements);
  res.status(201).json({ ...entry, linked: linked.length });
});

api.put("/catalog/:id", requireAdmin, async (req, res) => {
  const parsed = parseCatalogInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });
  const e = parsed.value;
  const row = await queryOne(
    `UPDATE vehicle_catalog SET brand = $1, model = $2, generation = $3, year_from = $4, year_to = $5, fuel_types = $6,
       tank_capacity = $7, lpg_tank_capacity = $8, note = $9, factory_consumption = $11
     WHERE id = $10 RETURNING *`,
    [
      e.brand,
      e.model,
      e.generation,
      e.yearFrom,
      e.yearTo ?? null,
      e.fuelTypes.join(","),
      e.tankCapacity,
      e.lpgTankCapacity ?? null,
      e.note ?? null,
      paramId(req),
      e.factoryConsumption?.length ? JSON.stringify(e.factoryConsumption) : null,
    ],
  );
  if (!row) return void res.status(404).json({ error: "Katalog kaydı bulunamadı." });
  res.json(toCatalogEntry(row));
});

/** Vehicles picked from this entry keep their data and simply become hand-entered. */
api.delete("/catalog/:id", requireAdmin, async (req, res) => {
  const [, deleted] = await transaction([
    { text: "UPDATE vehicles SET catalog_id = NULL WHERE catalog_id = $1", params: [paramId(req)] },
    { text: "DELETE FROM vehicle_catalog WHERE id = $1 RETURNING id", params: [paramId(req)] },
  ]);
  if (deleted.length === 0) return void res.status(404).json({ error: "Katalog kaydı bulunamadı." });
  res.status(204).end();
});

/** Hand-entered makes and models, counted only: the admin learns what to add, not whose car it is. */
api.get("/catalog/missing", requireAdmin, async (_req, res) => {
  const rows = await query(
    `SELECT initcap(trim(brand)) AS brand, initcap(trim(model)) AS model, year, fuel_type, COUNT(*) AS n
     FROM vehicles
     WHERE catalog_id IS NULL AND brand IS NOT NULL AND model IS NOT NULL
     GROUP BY 1, 2, 3, 4
     ORDER BY n DESC, 1, 2`,
  );
  res.json(
    rows.map((r) => ({
      brand: r.brand as string,
      model: r.model as string,
      year: r.year == null ? undefined : Number(r.year),
      fuelType: r.fuel_type,
      count: Number(r.n),
    })),
  );
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
  if (await limited(res, `member-add:${req.user!.id}`, 20)) return;
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
  if (await limited(res, `invite:${req.ip ?? "unknown"}`, 60)) return;
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
  if (await limited(res, `invite:${req.ip ?? "unknown"}`, 60)) return;
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
  const prior = await priorCreate("entries", input.id, req.user!.id);
  if (prior === "taken") return void res.status(409).json({ error: ID_TAKEN });
  if (prior === "same") return void res.json(toEntry((await queryOne(`${ENTRY_SELECT} WHERE e.id = $1`, [input.id]))!));
  const id = input.id ?? randomUUID();
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
       total_cost = $6, note = $7, updated_at = $8, updated_by = $9, is_full = $11, gauge_before = $12, fuel = $13
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
      e.isFull,
      e.gaugeBefore ?? null,
      e.fuel ?? null,
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
  const prior = await priorCreate("expenses", input.id, req.user!.id);
  if (prior === "taken") return void res.status(409).json({ error: ID_TAKEN });
  if (prior === "same") return void res.json(toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [input.id]))!));
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const statements: Statement[] = [
    {
      text: `INSERT INTO expenses (id, vehicle_id, date, category, amount, note, created_by, created_at, details)
             SELECT $1::text, $2::text, $3::text, $4::text, $5::float8, $6::text, $7::text, $8::text, $9::text
             WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = $2::text)
             RETURNING id`,
      params: [id, input.vehicleId, input.date, input.category, input.amount, input.note ?? null, req.user!.id, now, input.details ? JSON.stringify(input.details) : null],
    },
  ];
  if (input.photo) {
    statements.push({
      text: "INSERT INTO expense_photos (expense_id, data, created_at) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM expenses WHERE id = $1)",
      params: [id, input.photo, now],
    });
  }
  const [rows] = await transaction(statements);
  if (rows.length === 0) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.status(201).json(toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [id]))!));
});

api.put("/expenses/:id", requireUser, async (req, res) => {
  const denied = await checkEditable(req, "expenses");
  if (denied) return void res.status(denied[0]).json({ error: denied[1] });
  const parsed = parseExpenseInput(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });

  const x: ExpenseInput = parsed.value;
  const now = new Date().toISOString();
  const statements: Statement[] = [
    {
      text: `UPDATE expenses SET vehicle_id = $1, date = $2, category = $3, amount = $4, note = $5,
               updated_at = $6, updated_by = $7, details = $9
             WHERE id = $8 AND EXISTS (SELECT 1 FROM vehicles WHERE id = $1)
             RETURNING id`,
      params: [x.vehicleId, x.date, x.category, x.amount, x.note ?? null, now, req.user!.id, paramId(req), x.details ? JSON.stringify(x.details) : null],
    },
  ];
  // photo: a new one replaces the old, null removes it, absent leaves it alone.
  if (x.photo === null) statements.push({ text: "DELETE FROM expense_photos WHERE expense_id = $1", params: [paramId(req)] });
  if (x.photo) {
    statements.push({
      text: `INSERT INTO expense_photos (expense_id, data, created_at) VALUES ($1, $2, $3)
             ON CONFLICT (expense_id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
      params: [paramId(req), x.photo, now],
    });
  }
  const [updated] = await transaction(statements);
  if (updated.length === 0) return void res.status(404).json({ error: "Araç bulunamadı." });
  res.json(toExpense((await queryOne(`${EXPENSE_SELECT} WHERE x.id = $1`, [paramId(req)]))!));
});

/** An expense's invoice photo; anyone on the vehicle may see it. */
api.get("/expenses/:id/photo", requireUser, async (req, res) => {
  if (!(await recordAccess(req, "expenses", paramId(req)))) return void res.status(404).json({ error: NOT_FOUND });
  const row = await queryOne("SELECT data FROM expense_photos WHERE expense_id = $1", [paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Bu masrafa fotoğraf eklenmemiş." });
  res.json({ image: row.data });
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
  const prior = await priorCreate("reminders", r.id, req.user!.id);
  if (prior === "taken") return void res.status(409).json({ error: ID_TAKEN });
  if (prior === "same") return void res.json(await reminderResponse(r.id!));
  const id = r.id ?? randomUUID();
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
      const base = reminder.due_km != null ? Number(reminder.due_km) : ((await latestKm(reminder.vehicle_id as string)) ?? 0);
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

// ---- Reminder notifications (Web Push) ----------------------------------------

api.get("/push/key", requireUser, async (_req, res) => {
  res.json({ publicKey: (await vapidKeys()).publicKey });
});

// The browsers' push services. The server sends notifications to whatever address a device
// registers, so anything else (an internal address, someone else's server) is refused.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

function isPushService(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

api.post("/push/subscribe", requireUser, async (req, res) => {
  const b = (req.body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof b.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b.keys?.auth === "string" ? b.keys.auth : "";
  if (!isPushService(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return void res.status(400).json({ error: "Geçersiz bildirim aboneliği." });
  }
  // A device belongs to whoever signed in on it last.
  await query(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [endpoint, req.user!.id, p256dh, auth, new Date().toISOString()],
  );
  res.status(204).end();
});

api.post("/push/unsubscribe", requireUser, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  await query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, req.user!.id]);
  res.status(204).end();
});

api.post("/push/test", requireUser, async (req, res) => {
  if (await limited(res, `push-test:${req.user!.id}`, 5)) return;
  const sent = await sendToUser(req.user!.id, {
    title: "CarLog bildirimleri açık",
    body: "Muayene, sigorta ve diğer hatırlatmalar yaklaşınca buradan haber vereceğiz.",
    url: "/#/",
    tag: "test",
  });
  res.json({ sent });
});

// Daily job (Vercel Cron, see vercel.json). Only Vercel's scheduler may call it: it sends
// CRON_SECRET as a bearer token. Without that variable the job stays switched off.
api.get("/cron/reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("cron/reminders: CRON_SECRET is not set; the reminder job is disabled.");
    return void res.status(503).json({ error: "Görev kapalı." });
  }
  if (!secretsMatch(req.headers.authorization ?? "", `Bearer ${secret}`)) {
    return void res.status(401).json({ error: "Yetkisiz." });
  }
  res.json({ reminders: await sendReminderNotifications(), monthly: await sendMonthlySummaries() });
});

// ---- Live support ------------------------------------------------------------

const isStaff = (req: Request) => req.user!.role === "admin" || req.user!.role === "moderator";

function toThread(row: Row, staff: boolean): SupportThread {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    username: (row.username as string | null) ?? null,
    subject: row.subject as string,
    status: row.status as SupportStatus,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    lastMessageAt: new Date(row.last_message_at as string | Date).toISOString(),
    lastMessage: (row.last_body as string | null) ?? null,
    lastFromStaff: Boolean(row.last_from_staff),
    unread: Boolean(staff ? row.staff_unread : row.user_unread),
    context: staff ? ((row.context as string | null) ?? null) : null,
  };
}

const THREAD_SELECT = `
  SELECT t.*, u.username,
    (SELECT body FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
    (SELECT from_staff FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_from_staff
  FROM support_threads t LEFT JOIN users u ON u.id = t.user_id`;

function messageBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.trim();
  // Longer than the box allows: refuse rather than cut the message off unseen.
  return body && body.length <= 2000 ? body : null;
}

/** The thread if the caller may see it: their own, or any for staff. */
async function visibleThread(req: Request, id: string) {
  const row = await queryOne("SELECT * FROM support_threads WHERE id = $1", [id]);
  if (!row) return null;
  return isStaff(req) || row.user_id === req.user!.id ? row : null;
}

/** Tells the other side about a new message: the user, or every admin and moderator. */
async function notifySupport(thread: Row, fromStaff: boolean, body: string) {
  try {
    if (fromStaff) {
      await sendToUser(String(thread.user_id), { title: "CarLog Destek yanıtladı", body: body.slice(0, 120), url: "/#/destek", tag: `support-${thread.id}` });
    } else {
      const staff = await query("SELECT id FROM users WHERE role IN ('admin', 'moderator')");
      for (const s of staff) {
        await sendToUser(String(s.id), { title: `Destek: ${thread.subject}`.slice(0, 80), body: body.slice(0, 120), url: `/#/admin/destek`, tag: `support-${thread.id}` });
      }
    }
  } catch {
    // A failed notification doesn't undo the message.
  }
}

/** The signed-in user's own conversations, newest first. */
api.get("/support/threads", requireUser, async (req, res) => {
  res.json((await query(`${THREAD_SELECT} WHERE t.user_id = $1 ORDER BY t.last_message_at DESC LIMIT 50`, [req.user!.id])).map((r) => toThread(r, false)));
});

/** Opens a conversation with its first message; context is the page and device it came from. */
api.post("/support/threads", requireUser, async (req, res) => {
  if (await limited(res, `support:${req.user!.id}`, 40)) return;
  const body = messageBody(req.body?.body);
  if (!body) return void res.status(400).json({ error: "Mesajınızı yazın (en fazla 2000 karakter)." });
  const subject = (typeof req.body?.subject === "string" && req.body.subject.trim().slice(0, 80)) || body.slice(0, 60);
  const context = typeof req.body?.context === "string" ? req.body.context.slice(0, 300) : null;
  const id = randomUUID();
  await transaction([
    { text: "INSERT INTO support_threads (id, user_id, subject, context) VALUES ($1, $2, $3, $4)", params: [id, req.user!.id, subject, context] },
    { text: "INSERT INTO support_messages (id, thread_id, sender_id, from_staff, body) VALUES ($1, $2, $3, false, $4)", params: [randomUUID(), id, req.user!.id, body] },
  ]);
  const row = (await queryOne(`${THREAD_SELECT} WHERE t.id = $1`, [id]))!;
  void notifySupport(row, false, body);
  res.status(201).json(toThread(row, false));
});

/** A conversation's messages; ?after= returns only newer ones (for polling). Marks it read for the reader. */
api.get("/support/threads/:id/messages", requireUser, async (req, res) => {
  const thread = await visibleThread(req, paramId(req));
  if (!thread) return void res.status(404).json({ error: "Konuşma bulunamadı." });
  const after = typeof req.query.after === "string" && !Number.isNaN(Date.parse(req.query.after)) ? req.query.after : null;
  const rows = await query(
    `SELECT m.*, u.username FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.thread_id = $1 ${after ? "AND m.created_at > $2::timestamptz" : ""} ORDER BY m.created_at`,
    after ? [paramId(req), after] : [paramId(req)],
  );
  const staff = isStaff(req) && thread.user_id !== req.user!.id;
  await query(`UPDATE support_threads SET ${staff ? "staff_unread" : "user_unread"} = false WHERE id = $1`, [paramId(req)]);
  res.json({
    status: thread.status,
    messages: rows.map(
      (r): SupportMessage => ({
        id: r.id as string,
        threadId: r.thread_id as string,
        sender: (r.username as string | null) ?? null,
        fromStaff: Boolean(r.from_staff),
        body: r.body as string,
        createdAt: new Date(r.created_at as string | Date).toISOString(),
      }),
    ),
  });
});

/** Adds a message. A user writing to a closed conversation reopens it. */
api.post("/support/threads/:id/messages", requireUser, async (req, res) => {
  const thread = await visibleThread(req, paramId(req));
  if (!thread) return void res.status(404).json({ error: "Konuşma bulunamadı." });
  if (await limited(res, `support:${req.user!.id}`, 40)) return;
  const body = messageBody(req.body?.body);
  if (!body) return void res.status(400).json({ error: "Mesajınızı yazın (en fazla 2000 karakter)." });
  const staff = isStaff(req) && thread.user_id !== req.user!.id;
  const id = randomUUID();
  await transaction([
    { text: "INSERT INTO support_messages (id, thread_id, sender_id, from_staff, body) VALUES ($1, $2, $3, $4, $5)", params: [id, thread.id, req.user!.id, staff, body] },
    {
      text: `UPDATE support_threads SET last_message_at = now(), ${staff ? "user_unread = true" : "staff_unread = true, status = 'open'"} WHERE id = $1`,
      params: [thread.id],
    },
  ]);
  void notifySupport(thread, staff, body);
  const row = await queryOne("SELECT m.*, u.username FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = $1", [id]);
  res.status(201).json({
    id,
    threadId: thread.id as string,
    sender: (row?.username as string | null | undefined) ?? null,
    fromStaff: staff,
    body,
    createdAt: new Date(row!.created_at as string | Date).toISOString(),
  } satisfies SupportMessage);
});

/** How many conversations have news for the caller (user: staff replies; staff: user messages). */
api.get("/support/unread", requireUser, async (req, res) => {
  const mine = await queryOne("SELECT COUNT(*) AS n FROM support_threads WHERE user_id = $1 AND user_unread", [req.user!.id]);
  const staff = isStaff(req) ? await queryOne("SELECT COUNT(*) AS n FROM support_threads WHERE staff_unread") : null;
  res.json({ mine: Number(mine?.n ?? 0), staff: staff ? Number(staff.n) : 0 });
});

/** Staff inbox: open conversations first, then the rest, newest first. */
api.get("/admin/support/threads", requireStaff, async (req, res) => {
  const status = req.query.status === "closed" ? "closed" : req.query.status === "all" ? null : "open";
  const rows = await query(
    `${THREAD_SELECT} ${status ? "WHERE t.status = $1" : ""} ORDER BY t.staff_unread DESC, t.last_message_at DESC LIMIT 200`,
    status ? [status] : [],
  );
  res.json(rows.map((r) => toThread(r, true)));
});

/** Close or reopen a conversation. */
api.put("/admin/support/threads/:id", requireStaff, async (req, res) => {
  const status = req.body?.status === "closed" ? "closed" : req.body?.status === "open" ? "open" : null;
  if (!status) return void res.status(400).json({ error: "Geçersiz durum." });
  const row = await queryOne("UPDATE support_threads SET status = $1 WHERE id = $2 RETURNING id", [status, paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Konuşma bulunamadı." });
  res.json(toThread((await queryOne(`${THREAD_SELECT} WHERE t.id = $1`, [paramId(req)]))!, true));
});

/** Who the staff is talking to: account, plan, activity and their recent errors (to help debug). */
api.get("/admin/support/threads/:id/user", requireStaff, async (req, res) => {
  const thread = await queryOne("SELECT user_id FROM support_threads WHERE id = $1", [paramId(req)]);
  if (!thread) return void res.status(404).json({ error: "Konuşma bulunamadı." });
  const u = await queryOne(
    `SELECT u.*, (SELECT COUNT(*) FROM vehicle_members m WHERE m.user_id = u.id AND m.role = 'owner') AS owned,
            (SELECT COUNT(*) FROM entries e WHERE e.created_by = u.id) AS fills
     FROM users u WHERE u.id = $1`,
    [thread.user_id],
  );
  if (!u) return void res.status(404).json({ error: "Kullanıcı silinmiş." });
  const errors = await query("SELECT message, url, created_at FROM app_errors WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5", [thread.user_id]);
  res.json({
    ...toUser(u),
    lastSeenAt: u.last_seen_at ? new Date(u.last_seen_at as string | Date).toISOString() : null,
    ownedVehicles: Number(u.owned),
    fillUps: Number(u.fills),
    recentErrors: errors.map((e) => ({ message: e.message, url: e.url, at: new Date(e.created_at as string | Date).toISOString() })),
  });
});

// ---- Users (admin) ---------------------------------------------------------

api.get("/users", requireAdmin, async (_req, res) => {
  res.json(
    (
      await query(
        `SELECT u.*, (SELECT COUNT(*) FROM vehicle_members m WHERE m.user_id = u.id AND m.role = 'owner') AS owned
         FROM users u ORDER BY u.created_at`,
      )
    ).map((r) => ({
      ...toUser(r),
      ownedVehicles: Number(r.owned),
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at as string | Date).toISOString() : null,
    })),
  );
});

api.post("/users", requireAdmin, async (req, res) => {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return void res.status(400).json({ error: parsed.error });
  const role = req.body?.role === "admin" ? "admin" : req.body?.role === "moderator" ? "moderator" : "user";

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

/** Admins set anyone's plan (e.g. a gift, or a correction while payments aren't live). */
api.put("/users/:id/plan", requireAdmin, async (req, res) => {
  const plan = PLANS.find((p) => p.id === req.body?.plan);
  if (!plan) return void res.status(400).json({ error: "Geçersiz paket." });
  const row = await queryOne("UPDATE users SET plan = $1, plan_since = $2 WHERE id = $3 RETURNING id", [
    plan.id as PlanId,
    new Date().toISOString(),
    paramId(req),
  ]);
  if (!row) return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  res.status(204).end();
});

/** Admins change someone's role (e.g. make a moderator). Never their own, never the last admin. */
api.put("/users/:id/role", requireAdmin, async (req, res) => {
  const role = req.body?.role;
  if (role !== "admin" && role !== "moderator" && role !== "user") return void res.status(400).json({ error: "Geçersiz rol." });
  if (paramId(req) === req.user!.id) return void res.status(400).json({ error: "Kendi rolünüzü değiştiremezsiniz." });
  const row = await queryOne("UPDATE users SET role = $1 WHERE id = $2 RETURNING *", [role, paramId(req)]);
  if (!row) return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  // A changed role takes effect everywhere at once: sign the account out.
  await query("DELETE FROM sessions WHERE user_id = $1", [paramId(req)]);
  res.json(toUser(row));
});

/** Figures for the admin dashboard. */
api.get("/admin/stats", requireAdmin, async (_req, res) => {
  const one = async (sql: string) => Number((await queryOne(sql))?.n ?? 0);
  const series = async (sql: string) =>
    (await query(sql)).map((r) => ({ day: new Date(r.day as string | Date).toISOString().slice(0, 10), n: Number(r.n) }));
  res.json({
    users: await one("SELECT COUNT(*) AS n FROM users"),
    moderators: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'moderator'"),
    admins: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
    active7: await one("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > now() - interval '7 days'"),
    active30: await one("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > now() - interval '30 days'"),
    new7: await one("SELECT COUNT(*) AS n FROM users WHERE created_at::timestamptz > now() - interval '7 days'"),
    vehicles: await one("SELECT COUNT(*) AS n FROM vehicles"),
    entries: await one("SELECT COUNT(*) AS n FROM entries"),
    expenses: await one("SELECT COUNT(*) AS n FROM expenses"),
    errors24h: await one("SELECT COUNT(*) AS n FROM app_errors WHERE created_at > now() - interval '24 hours'"),
    supportOpen: await one("SELECT COUNT(*) AS n FROM support_threads WHERE status = 'open'"),
    supportUnread: await one("SELECT COUNT(*) AS n FROM support_threads WHERE staff_unread"),
    plans: (await query("SELECT plan, COUNT(*) AS n FROM users GROUP BY plan")).map((r) => ({ plan: r.plan, n: Number(r.n) })),
    signups: await series(
      `SELECT date_trunc('day', created_at::timestamptz) AS day, COUNT(*) AS n FROM users
       WHERE created_at::timestamptz > now() - interval '30 days' GROUP BY 1 ORDER BY 1`,
    ),
    fillUps: await series(
      `SELECT date_trunc('day', created_at::timestamptz) AS day, COUNT(*) AS n FROM entries
       WHERE created_at::timestamptz > now() - interval '30 days' GROUP BY 1 ORDER BY 1`,
    ),
  });
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
 * What deleting a user does to their vehicles: each passes to its longest-standing helper, and
 * vehicles without helpers are deleted with their records. Returns the statements (one
 * transaction) and a description for the confirmation step, or null when they own nothing.
 */
async function userDeletion(userId: string): Promise<{ statements: Statement[]; warning: string | null }> {
  const owned = await query(
    `SELECT m.vehicle_id,
       (SELECT COUNT(*) FROM vehicle_members h WHERE h.vehicle_id = m.vehicle_id AND h.role = 'helper') AS helpers
     FROM vehicle_members m WHERE m.user_id = $1 AND m.role = 'owner'`,
    [userId],
  );
  const orphaned = owned.filter((o) => Number(o.helpers) === 0).length;
  const handedOver = owned.length - orphaned;
  const parts = [];
  if (handedOver) parts.push(`${handedOver} aracı yardımcılarından birine devredilecek`);
  if (orphaned) parts.push(`yardımcısı olmayan ${orphaned} aracı tüm kayıtlarıyla silinecek`);

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
  return { statements, warning: owned.length > 0 ? `${owned.length} aracın sahibi: ${parts.join(", ")}.` : null };
}

/** Without ?force=1 the API first answers 409 describing what happens to the user's vehicles. */
api.delete("/users/:id", requireAdmin, async (req, res) => {
  const userId = paramId(req);
  if (userId === req.user!.id) {
    return void res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  }
  if (!(await queryOne("SELECT 1 FROM users WHERE id = $1", [userId]))) {
    return void res.status(404).json({ error: "Kullanıcı bulunamadı." });
  }
  const { statements, warning } = await userDeletion(userId);
  if (warning && req.query.force !== "1") return void res.status(409).json({ error: `Bu kullanıcı ${warning}` });
  await transaction(statements);
  res.status(204).end();
});

/**
 * Users delete their own account (KVKK: the right to have one's data erased), after typing their
 * password. Like the admin's delete, owned vehicles pass to a helper or go with their records; the
 * first call without force answers 409 with what will happen. The last admin can't leave.
 */
api.post("/account/delete", requireUser, async (req, res) => {
  const throttleKey = `password:${req.user!.id}`;
  if (await isThrottled(throttleKey, 5)) return void res.status(429).json({ error: TOO_MANY_ATTEMPTS });
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 200) : "";
  const row = await queryOne("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  if (!row || !(await verifyLogin(password, row.password_hash as string))) {
    await recordAttempt(throttleKey);
    return void res.status(403).json({ error: "Şifre hatalı." });
  }
  if (req.user!.role === "admin" && !(await queryOne("SELECT 1 FROM users WHERE role = 'admin' AND id <> $1", [req.user!.id]))) {
    return void res.status(400).json({ error: "Son yönetici hesabı silinemez; önce başka bir yönetici ekleyin." });
  }
  const { statements, warning } = await userDeletion(req.user!.id);
  if (warning && req.body?.force !== true) return void res.status(409).json({ error: `Hesabınız ${warning}`, code: "has_vehicles" });
  await transaction(statements);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
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

  // Imported vehicles count toward the plan like any other; ones over the limit are left out.
  const ownedRow = await queryOne("SELECT COUNT(*) AS n FROM vehicle_members WHERE user_id = $1 AND role = 'owner'", [req.user!.id]);
  let room = Math.max(0, vehicleLimit(req.user!) - Number(ownedRow?.n ?? 0));

  const vehicleStatements: Statement[] = [];
  for (const raw of vehicles) {
    const r = raw as Record<string, unknown>;
    const parsed = parseVehicleInput(r);
    if (!parsed.ok || typeof r.id !== "string" || taken.has(r.id)) continue;
    if (room <= 0) continue;
    room--;
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

// ---- Fuel prices per city (server/fuelPrices.ts) ----

api.use(fuelPrices);
