import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import type { User } from "../src/types.ts";
import { query, queryOne, toUser } from "./db.ts";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "carlog_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function createSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    userId,
    expiresAt.toISOString(),
  ]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Vercel serves over HTTPS; local development is plain HTTP.
    secure: Boolean(process.env.VERCEL),
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = readSessionToken(req);
  if (token) await query("DELETE FROM sessions WHERE token = $1", [token]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/** Attaches req.user when a valid session cookie is present. */
export async function loadUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readSessionToken(req);
  if (token) {
    const row = await queryOne(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > now()`,
      [token],
    );
    if (row) req.user = toUser(row);
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Bu işlem için admin yetkisi gerekiyor." });
    return;
  }
  next();
}

export async function purgeExpired(): Promise<void> {
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  await query("DELETE FROM login_attempts WHERE reset_at <= now()");
}

// Per-IP brake on failed logins so passwords can't be brute-forced.
const MAX_FAILED_LOGINS = 10;

export async function isLoginBlocked(ip: string): Promise<boolean> {
  const row = await queryOne("SELECT count FROM login_attempts WHERE ip = $1 AND reset_at > now()", [ip]);
  return row != null && Number(row.count) >= MAX_FAILED_LOGINS;
}

export async function recordFailedLogin(ip: string): Promise<void> {
  await query(
    `INSERT INTO login_attempts (ip, count, reset_at) VALUES ($1, 1, now() + interval '15 minutes')
     ON CONFLICT (ip) DO UPDATE SET
       count    = CASE WHEN login_attempts.reset_at > now() THEN login_attempts.count + 1 ELSE 1 END,
       reset_at = CASE WHEN login_attempts.reset_at > now() THEN login_attempts.reset_at
                       ELSE now() + interval '15 minutes' END`,
    [ip],
  );
}

export async function clearFailedLogins(ip: string): Promise<void> {
  await query("DELETE FROM login_attempts WHERE ip = $1", [ip]);
}
