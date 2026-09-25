// Local server: `npm run dev` (with Vite) or `npm start` (serves dist/). On Vercel, api/index.ts is used instead.
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import express from "express";
import app from "./app.ts";
import { databaseUrl } from "./db.ts";

const isDev = process.argv.includes("--dev");
const PORT = Number(process.env.PORT ?? 5173);
const ROOT = join(import.meta.dirname, "..");

const httpServer = createServer(app);

if (isDev) {
  // Serve the React app through Vite in the same process, so one command and one port cover both.
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const dist = join(ROOT, "dist");
  if (!existsSync(join(dist, "index.html"))) {
    console.error('dist/ bulunamadı. Önce "npm run build" çalıştırın ya da geliştirme için "npm run dev" kullanın.');
    process.exit(1);
  }
  app.use(express.static(dist));
}

httpServer.listen(PORT, "0.0.0.0", () => {
  const database = databaseUrl() ? "Postgres (DATABASE_URL)" : "yerel PGlite (data/pglite)";
  console.log(`\n  CarLog ${isDev ? "(geliştirme) " : ""}çalışıyor — veritabanı: ${database}`);
  console.log(`  ➜ Bu bilgisayar:  http://localhost:${PORT}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === "IPv4" && !a.internal) console.log(`  ➜ Ağdaki cihazlar: http://${a.address}:${PORT}`);
    }
  }
  console.log();
});
