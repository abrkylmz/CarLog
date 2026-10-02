import { useMemo, useState } from "react";
import { Bell, CalendarDays, Car, ChevronDown, Fuel, LayoutDashboard, LogOut, Receipt, Search, ShieldCheck } from "lucide-react";
import { EXPENSE_CATEGORY_LABELS, formatDate, formatTL } from "../lib/format";
import { usePopover } from "../lib/popover";
import { reminderStatus } from "../lib/reminders";
import { navigate, paths } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { Expense, FuelEntry, Reminder, User, Vehicle } from "../types";
import { reminderTitle } from "./Reminders";
import UpcomingReminders from "./UpcomingReminders";

const panel =
  "pop-in absolute z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900";

// ---- Search -------------------------------------------------------------------

interface SearchProps {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
}

interface Hit {
  key: string;
  href: string;
  title: string;
  detail: string;
  icon: typeof Car;
  accent?: string;
}

const fold = (t: string) => t.toLocaleLowerCase("tr-TR");

/** Finds vehicles, fill-ups, expenses and reminders by name, plate, note, category or date. */
export function SearchBox({ vehicles, entries, expenses, reminders }: SearchProps) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const { open, setOpen, ref } = usePopover();

  const hits = useMemo<Hit[]>(() => {
    const term = fold(q.trim());
    if (term.length < 2) return [];
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const has = (...fields: (string | null | undefined)[]) => fields.some((f) => f && fold(f).includes(term));
    const out: Hit[] = [];

    for (const v of vehicles) {
      if (has(v.name, v.plate, v.brand, v.model)) {
        out.push({
          key: v.id,
          href: paths.vehicle(v.id),
          title: v.name,
          detail: [v.plate, v.brand, v.model].filter(Boolean).join(" · ") || "Araç",
          icon: Car,
          accent: FUEL_ACCENT[v.fuelType],
        });
      }
    }
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const v = byId.get(e.vehicleId);
      if (v && has(e.note, formatDate(e.date), v.name)) {
        out.push({
          key: e.id,
          href: paths.vehicle(v.id, "dolumlar"),
          title: `${formatDate(e.date)} · ${formatTL(e.totalCost)}`,
          detail: [v.name, e.note].filter(Boolean).join(" · "),
          icon: Fuel,
          accent: FUEL_ACCENT[v.fuelType],
        });
      }
    }
    for (const x of [...expenses].sort((a, b) => b.date.localeCompare(a.date))) {
      const v = byId.get(x.vehicleId);
      if (v && has(EXPENSE_CATEGORY_LABELS[x.category], x.note, formatDate(x.date))) {
        out.push({
          key: x.id,
          href: paths.vehicle(v.id, "masraflar"),
          title: `${EXPENSE_CATEGORY_LABELS[x.category]} · ${formatTL(x.amount)}`,
          detail: [formatDate(x.date), v.name, x.note].filter(Boolean).join(" · "),
          icon: Receipt,
          accent: FUEL_ACCENT[v.fuelType],
        });
      }
    }
    for (const r of reminders) {
      const v = byId.get(r.vehicleId);
      if (v && !r.doneAt && has(reminderTitle(r), r.note)) {
        out.push({
          key: r.id,
          href: paths.vehicle(v.id, "hatirlatmalar"),
          title: reminderTitle(r),
          detail: [r.dueDate ? formatDate(r.dueDate) : null, v.name].filter(Boolean).join(" · "),
          icon: Bell,
          accent: FUEL_ACCENT[v.fuelType],
        });
      }
    }
    return out.slice(0, 8);
  }, [q, vehicles, entries, expenses, reminders]);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    navigate(hit.href);
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter" && hits[cursor]) {
            go(hits[cursor]);
          }
        }}
        placeholder="Araç, kayıt veya masraf ara…"
        aria-label="Ara"
        className="w-full rounded-xl border border-slate-200 bg-slate-100/70 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-brand-600"
      />
      {open && q.trim().length >= 2 ? (
        <div className={`${panel} left-0 w-full`}>
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">"{q.trim()}" için sonuç yok.</p>
          ) : (
            <ul className="py-1">
              {hits.map((hit, i) => (
                <li key={hit.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === cursor ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                  >
                    <span data-accent={hit.accent} className="rounded-lg bg-brand-50 p-1.5 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                      <hit.icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{hit.title}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{hit.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---- Year ---------------------------------------------------------------------

export function YearSelect({ years, value, onChange }: { years: number[]; value: number; onChange: (year: number) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <CalendarDays size={15} className="pointer-events-none absolute left-3 text-slate-500 dark:text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Yıl"
        className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm font-medium outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 text-slate-400" />
    </label>
  );
}

// ---- Reminders bell -------------------------------------------------------------

export function ReminderBell({ vehicles, reminders, latestKmByVehicle }: {
  vehicles: Vehicle[];
  reminders: Reminder[];
  latestKmByVehicle: Map<string, number | null>;
}) {
  const { open, toggle, ref } = usePopover();
  const known = new Set(vehicles.map((v) => v.id));
  let overdue = 0;
  let soon = 0;
  for (const r of reminders) {
    if (r.doneAt || !known.has(r.vehicleId)) continue;
    const level = reminderStatus(r, latestKmByVehicle.get(r.vehicleId) ?? null).level;
    if (level === "overdue") overdue++;
    else if (level === "soon") soon++;
  }
  const count = overdue + soon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={count ? `Hatırlatmalar: ${count} yaklaşan veya gecikmiş` : "Hatırlatmalar"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell size={19} />
        {count ? (
          <span
            className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950 ${
              overdue ? "pulse-alert bg-red-500" : "bg-amber-500"
            }`}
          >
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={`${panel} right-0 w-[min(24rem,calc(100vw-2rem))] p-3 [&_section]:mb-0`}>
          {count ? (
            <UpcomingReminders reminders={reminders} vehicles={vehicles} latestKmByVehicle={latestKmByVehicle} />
          ) : (
            <p className="px-1 py-2 text-sm text-slate-500 dark:text-slate-400">
              Yaklaşan veya gecikmiş hatırlatma yok. Hepsi yolunda.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---- Account ------------------------------------------------------------------

export function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { open, toggle, ref } = usePopover();
  const isAdmin = user.role === "admin";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Hesap menüsü"
        className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold uppercase text-white">
          {user.username.slice(0, 1)}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">{user.username}</span>
        <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
      </button>
      {open ? (
        <div className={`${panel} right-0 w-56 py-1 text-sm`}>
          <p className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {isAdmin ? <ShieldCheck size={15} /> : null}
            <span className="truncate">
              <span className="font-medium text-slate-800 dark:text-slate-100">{user.username}</span> · {isAdmin ? "Yönetici" : "Kullanıcı"}
            </span>
          </p>
          {isAdmin ? (
            <a href={paths.admin} className="flex items-center gap-2 px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <LayoutDashboard size={16} />
              Yönetici Paneli
            </a>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut size={16} />
            Çıkış Yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
