import { formatNumber } from "./format";
import type { Reminder } from "../types";

export type ReminderLevel = "overdue" | "soon" | "planned" | "done";

/** A reminder counts as "soon" this many days / km before it's due. */
export const SOON_DAYS = 30;
export const SOON_KM = 1000;

export interface ReminderStatus {
  level: ReminderLevel;
  /** e.g. "12 gün kaldı", "3 gün gecikti", "850 km kaldı" */
  text: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function todayIso(): string {
  const d = new Date();
  // Local calendar day, so "today" matches the user's clock rather than UTC.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Status from whichever limit comes first: the due date or the due odometer reading
 * (compared with the vehicle's latest fill-up).
 */
export function reminderStatus(reminder: Reminder, latestKm: number | null, today = todayIso()): ReminderStatus {
  if (reminder.doneAt) return { level: "done", text: "Tamamlandı" };

  const parts: { level: ReminderLevel; text: string; urgency: number }[] = [];

  if (reminder.dueDate) {
    const days = daysBetween(today, reminder.dueDate);
    if (days < 0) parts.push({ level: "overdue", text: `${-days} gün gecikti`, urgency: days });
    else if (days === 0) parts.push({ level: "overdue", text: "Bugün", urgency: 0 });
    else
      parts.push({
        level: days <= SOON_DAYS ? "soon" : "planned",
        text: `${days} gün kaldı`,
        urgency: days,
      });
  }

  if (reminder.dueKm != null && latestKm != null) {
    const left = reminder.dueKm - latestKm;
    if (left <= 0) parts.push({ level: "overdue", text: `${formatNumber(-left, 0)} km geçti`, urgency: -1 });
    else
      parts.push({
        level: left <= SOON_KM ? "soon" : "planned",
        text: `${formatNumber(left, 0)} km kaldı`,
        // Rough exchange rate so a near km limit outranks a far date: ~40 km a day.
        urgency: left / 40,
      });
  } else if (reminder.dueKm != null) {
    parts.push({ level: "planned", text: `${formatNumber(reminder.dueKm, 0)} km'de`, urgency: Infinity });
  }

  const rank: Record<ReminderLevel, number> = { overdue: 0, soon: 1, planned: 2, done: 3 };
  parts.sort((a, b) => rank[a.level] - rank[b.level] || a.urgency - b.urgency);
  return parts[0] ?? { level: "planned", text: "" };
}
