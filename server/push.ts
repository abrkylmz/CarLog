import webpush from "web-push";
import { query, queryOne } from "./db.ts";

// Reminder notifications over Web Push. The VAPID key pair comes from VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY when set; otherwise one is generated on first use and kept in app_meta, so
// notifications work without any setup.

const KIND_LABELS: Record<string, string> = {
  muayene: "Araç Muayenesi",
  sigorta: "Trafik Sigortası",
  kasko: "Kasko",
  bakim: "Bakım",
  vergi: "MTV Ödemesi",
  lastik: "Lastik Değişimi",
  egzoz: "Egzoz Emisyon",
  diger: "Diğer",
};

let keys: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const generated = webpush.generateVAPIDKeys();
    // Two instances may race on the very first request; whichever key pair lands first wins.
    await query(
      `INSERT INTO app_meta (key, value) VALUES ('vapid_keys', $1) ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(generated)],
    );
    const row = await queryOne(`SELECT value FROM app_meta WHERE key = 'vapid_keys'`);
    keys = JSON.parse(String(row!.value));
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://github.com/abrkylmz/CarLog", keys!.publicKey, keys!.privateKey);
  return keys!;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
}

/** Sends to every device of the user; subscriptions the push service has dropped are removed. */
export async function sendToUser(userId: string, message: PushMessage): Promise<number> {
  await vapidKeys();
  const subs = await query(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [userId]);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) } },
        JSON.stringify(message),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
      } else {
        console.error("push failed", status, (err as Error).message);
      }
    }
  }
  return sent;
}

/** Today's date in Turkey, YYYY-MM-DD. */
function todayInTurkey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const trDate = (iso: string) => iso.split("-").reverse().join(".");
const trNumber = (n: number) => Math.round(n).toLocaleString("tr-TR");

/**
 * Which notification a reminder is due for today, if any: 7, 3 and 1 day before, on the day and
 * once when overdue; for km-based reminders at 500 km left and when the limit is passed.
 */
function stages(dueDate: string | null, dueKm: number | null, today: string, latestKm: number | null) {
  const out: { stage: string; body: string }[] = [];
  if (dueDate) {
    const days = daysBetween(today, dueDate);
    const when = trDate(dueDate);
    if (days < 0) out.push({ stage: "overdue", body: `${-days} gün gecikti (${when})` });
    else if (days === 0) out.push({ stage: "d0", body: `Bugün son gün (${when})` });
    else if (days === 1) out.push({ stage: "d1", body: `Yarın son gün (${when})` });
    else if (days <= 3) out.push({ stage: "d3", body: `${days} gün kaldı (${when})` });
    else if (days <= 7) out.push({ stage: "d7", body: `${days} gün kaldı (${when})` });
  }
  if (dueKm != null && latestKm != null) {
    const left = dueKm - latestKm;
    if (left <= 0) out.push({ stage: "km0", body: `Km sınırı geçildi (${trNumber(dueKm)} km)` });
    else if (left <= 500) out.push({ stage: "km500", body: `${trNumber(left)} km kaldı (${trNumber(dueKm)} km)` });
  }
  return out;
}

/** Daily job: notify everyone on a vehicle about its reminders that just reached a new stage. */
export async function sendReminderNotifications(now = new Date()): Promise<{ checked: number; sent: number }> {
  const today = todayInTurkey(now);
  const rows = await query(
    `SELECT r.id, r.kind, r.title, r.due_date, r.due_km, r.vehicle_id, v.name AS vehicle_name,
            (SELECT MAX(e.odometer_km) FROM entries e WHERE e.vehicle_id = r.vehicle_id) AS latest_km
       FROM reminders r JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.done_at IS NULL AND (r.due_date IS NOT NULL OR r.due_km IS NOT NULL)`,
  );
  let sent = 0;
  for (const r of rows) {
    const due = stages(
      (r.due_date as string | null) ?? null,
      r.due_km == null ? null : Number(r.due_km),
      today,
      r.latest_km == null ? null : Number(r.latest_km),
    );
    for (const { stage, body } of due) {
      // Claim the stage first; only the claim that inserts the row sends, so it goes out once.
      const claimed = await query(
        `INSERT INTO push_sent (reminder_id, stage, sent_at) VALUES ($1, $2, $3)
         ON CONFLICT (reminder_id, stage) DO NOTHING RETURNING reminder_id`,
        [r.id, stage, now.toISOString()],
      );
      if (claimed.length === 0) continue;
      const members = await query(`SELECT user_id FROM vehicle_members WHERE vehicle_id = $1`, [r.vehicle_id]);
      const title = `${(r.title as string | null) || KIND_LABELS[String(r.kind)] || "Hatırlatma"} · ${r.vehicle_name}`;
      for (const m of members) {
        sent += await sendToUser(String(m.user_id), {
          title,
          body,
          url: `/#/arac/${encodeURIComponent(String(r.vehicle_id))}/hatirlatmalar`,
          tag: `reminder-${r.id}`,
        });
      }
    }
  }
  return { checked: rows.length, sent };
}
