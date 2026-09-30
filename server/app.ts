import express, { type NextFunction, type Request, type Response } from "express";
import { api } from "./api.ts";
import { loadUser } from "./auth.ts";

/** The /api backend, shared by the local server (server/index.ts) and the Vercel function (api/index.ts). */
const app = express();

app.disable("x-powered-by");
// On Vercel the client IP arrives via X-Forwarded-For, which Vercel's edge sets. Trusting only that
// one hop means a client can't pick its own IP by sending the header itself and dodge the limits.
if (process.env.VERCEL) app.set("trust proxy", 1);

/** API answers carry account data: never cached by the browser or a proxy, never sniffed or framed. */
function apiHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
}

/**
 * Requests that change data must come from CarLog's own pages. The session cookie is already
 * SameSite=Lax; this also stops another site from posting to the API through a user's browser.
 */
function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (origin) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      // "null" or a malformed origin
    }
    if (host !== req.headers.host) return void res.status(403).json({ error: "İzin verilmeyen istek." });
  }
  next();
}

// A coarse per-IP ceiling for every API call, kept in memory. Each server instance counts on its
// own, so it only stops floods; the precise limits (login, sign-up, writes) live in the database.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;
const hits = new Map<string, { count: number; resetAt: number }>();

function ipLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }
  const ip = req.ip ?? "unknown";
  const h = hits.get(ip);
  if (!h || h.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (++h.count > MAX_PER_WINDOW) {
    res.set("Retry-After", String(Math.ceil((h.resetAt - now) / 1000)));
    return void res.status(429).json({ error: "Çok fazla istek gönderildi. Biraz sonra tekrar deneyin." });
  }
  next();
}

app.use("/api", apiHeaders, ipLimit, sameOrigin, express.json({ limit: "2mb" }), loadUser, api);
app.use("/api", (_req, res) => void res.status(404).json({ error: "Bulunamadı." }));
app.use("/api", (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Bodies that are too large or not JSON are the client's fault; don't log them as crashes.
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) return void res.status(status).json({ error: "Geçersiz istek." });
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası." });
});

export default app;
