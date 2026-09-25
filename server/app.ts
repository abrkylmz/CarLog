import express, { type NextFunction, type Request, type Response } from "express";
import { api } from "./api.ts";
import { loadUser } from "./auth.ts";

/** The /api backend, shared by the local server (server/index.ts) and the Vercel function (api/index.ts). */
const app = express();

app.disable("x-powered-by");
// On Vercel the client IP arrives via X-Forwarded-For; the login throttle keys on it.
if (process.env.VERCEL) app.set("trust proxy", true);

app.use("/api", express.json({ limit: "2mb" }), loadUser, api);
app.use("/api", (_req, res) => void res.status(404).json({ error: "Bulunamadı." }));
app.use("/api", (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası." });
});

export default app;
