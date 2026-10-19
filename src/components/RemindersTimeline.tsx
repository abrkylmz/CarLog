import { CalendarClock } from "lucide-react";
import { formatNumber } from "../lib/format";
import { reminderStatus, todayIso } from "../lib/reminders";
import type { Reminder } from "../types";
import { ReminderStatusBadge, reminderTitle } from "./Reminders";

interface Props {
  reminders: Reminder[];
  latestKm: number | null;
  /** Average km driven per day lately, to date km-based reminders; null when unknown. */
  kmPerDay: number | null;
}

const DAY = 86_400_000;
const isoDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Open reminders on a vertical timeline by month, so a busy month (and its bills) shows up ahead of
 * time. A km-based reminder is placed on the day the vehicle is expected to reach that reading at
 * its recent pace, marked as an estimate.
 */
export default function RemindersTimeline({ reminders, latestKm, kmPerDay }: Props) {
  const today = todayIso();
  const items = reminders
    .filter((r) => !r.doneAt)
    .map((r) => {
      let kmDate: string | null = null;
      if (r.dueKm != null && latestKm != null && kmPerDay && kmPerDay > 0) {
        const left = r.dueKm - latestKm;
        kmDate = left <= 0 ? today : isoDay(Date.now() + Math.round(left / kmPerDay) * DAY);
      }
      // Whichever limit comes first decides where it sits.
      const dates = [r.dueDate ?? null, kmDate].filter((d): d is string => d != null).sort();
      return { reminder: r, date: dates[0] ?? null, estimated: dates[0] != null && dates[0] === kmDate && dates[0] !== r.dueDate };
    })
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  if (items.length === 0) return null;

  const groups: { label: string; late: boolean; items: typeof items }[] = [];
  for (const item of items) {
    const late = item.date != null && item.date < today;
    const label = late
      ? "Gecikmiş"
      : item.date
        ? new Date(`${item.date}T12:00:00`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
        : "Tarihi belirsiz";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, late, items: [item] });
  }

  return (
    <section className="card mb-8 p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <CalendarClock size={18} className="text-brand-500" />
        Zaman Çizelgesi
      </h3>
      <ol className="flex flex-col">
        {groups.map((g, gi) => (
          <li key={g.label} className="grid grid-cols-[5.5rem_1rem_1fr] gap-x-3 sm:grid-cols-[7rem_1rem_1fr]">
            <span className={`pt-0.5 text-right text-xs font-bold capitalize ${g.late ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
              {g.label}
            </span>
            <span className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ${g.late ? "bg-red-500 ring-red-100 dark:ring-red-950" : "bg-brand-500 ring-brand-100 dark:ring-brand-900/50"}`} />
              {gi < groups.length - 1 ? <span className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700" /> : null}
            </span>
            <ul className="flex min-w-0 flex-col gap-2 pb-5">
              {g.items.map(({ reminder: r, date, estimated }) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{reminderTitle(r)}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {r.dueKm != null ? `${formatNumber(r.dueKm, 0)} km'de` : null}
                      {r.dueKm != null && date ? " · " : null}
                      {date ? (estimated ? `tahminen ~${longDate(date)}` : longDate(date)) : r.dueKm == null ? "" : ""}
                    </span>
                  </span>
                  <ReminderStatusBadge status={reminderStatus(r, latestKm)} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {kmPerDay ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Kilometreye bağlı işlerin tarihi son aylardaki ortalama {formatNumber(kmPerDay, 0)} km/gün ile tahmin edilir.
        </p>
      ) : null}
    </section>
  );
}
