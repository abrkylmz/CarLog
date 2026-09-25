import { Bell, ChevronRight } from "lucide-react";
import { formatDate, formatNumber } from "../lib/format";
import { reminderStatus, type ReminderStatus } from "../lib/reminders";
import { paths } from "../lib/router";
import type { Reminder, Vehicle } from "../types";
import { ReminderStatusBadge, reminderTitle } from "./Reminders";

interface Props {
  reminders: Reminder[];
  vehicles: Vehicle[];
  latestKmByVehicle: Map<string, number | null>;
  /** Hide the vehicle name when every reminder belongs to the same vehicle. */
  showVehicle?: boolean;
}

/** Overdue and due-soon reminders, most urgent first; renders nothing when all is calm. */
export default function UpcomingReminders({ reminders, vehicles, latestKmByVehicle, showVehicle = true }: Props) {
  const vehicleName = new Map(vehicles.map((v) => [v.id, v.name]));
  const urgent = reminders
    .filter((r) => !r.doneAt && vehicleName.has(r.vehicleId))
    .map((r) => ({ reminder: r, status: reminderStatus(r, latestKmByVehicle.get(r.vehicleId) ?? null) }))
    .filter((x): x is { reminder: Reminder; status: ReminderStatus } => x.status.level === "overdue" || x.status.level === "soon")
    .sort((a, b) => (a.status.level === b.status.level ? 0 : a.status.level === "overdue" ? -1 : 1));

  if (urgent.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <Bell size={15} />
        Yaklaşan Hatırlatmalar
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {urgent.map(({ reminder: r, status }) => (
          <li key={r.id}>
            <a
              href={paths.vehicle(r.vehicleId, "hatirlatmalar")}
              className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {reminderTitle(r)}
                  {showVehicle ? (
                    <span className="font-normal text-slate-500 dark:text-slate-400"> · {vehicleName.get(r.vehicleId)}</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[r.dueDate ? formatDate(r.dueDate) : null, r.dueKm != null ? `${formatNumber(r.dueKm, 0)} km` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ReminderStatusBadge status={status} />
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
