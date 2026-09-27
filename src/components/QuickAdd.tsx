import { useState } from "react";
import { Bell, Car, ChevronRight, Fuel, Plus, Receipt } from "lucide-react";
import { FUEL_ACCENT } from "../lib/theme";
import { FUEL_TYPE_LABELS } from "../lib/format";
import type { ExpenseInput, FuelEntry, FuelEntryInput, ReminderInput, Vehicle } from "../types";
import EntryForm from "./EntryForm";
import ExpenseForm from "./ExpenseForm";
import Modal from "./Modal";
import { ReminderForm } from "./Reminders";

type Kind = "entry" | "expense" | "reminder";

interface Props {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  /** On a vehicle page the vehicle is known, so the picker step is skipped. */
  currentVehicleId?: string;
  /** Lift the button above the phone tab bar on vehicle pages. */
  aboveTabBar: boolean;
  onAddEntry: (input: FuelEntryInput) => Promise<void>;
  onAddExpense: (input: ExpenseInput) => Promise<void>;
  onAddReminder: (input: ReminderInput) => Promise<void>;
}

const ACTIONS: { kind: Kind; label: string; hint: string; icon: typeof Fuel }[] = [
  { kind: "entry", label: "Dolum Ekle", hint: "Yakıt alımı", icon: Fuel },
  { kind: "expense", label: "Masraf Ekle", hint: "Bakım, sigorta, otopark…", icon: Receipt },
  { kind: "reminder", label: "Hatırlatma Ekle", hint: "Muayene, sigorta, bakım tarihi", icon: Bell },
];

/** Floating "+" that adds a fill-up, expense or reminder from anywhere in two taps. */
export default function QuickAdd({
  vehicles,
  entries,
  currentVehicleId,
  aboveTabBar,
  onAddEntry,
  onAddExpense,
  onAddReminder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const accent = vehicle ? FUEL_ACCENT[vehicle.fuelType] : undefined;

  function start() {
    // Skip choosing when the vehicle is obvious.
    setVehicleId(currentVehicleId ?? (vehicles.length === 1 ? vehicles[0].id : null));
    setKind(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setKind(null);
  }

  const vehicleEntries = vehicle ? entries.filter((e) => e.vehicleId === vehicle.id) : [];
  const latestKm = vehicleEntries.reduce<number | null>((max, e) => (max == null || e.odometerKm > max ? e.odometerKm : max), null);

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label="Hızlı ekle: dolum, masraf veya hatırlatma"
        className={`fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white/60 transition hover:bg-brand-700 active:scale-95 dark:ring-slate-950/60 sm:bottom-6 sm:right-6 ${
          aboveTabBar ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <Plus size={28} />
      </button>

      {open && !vehicle ? (
        <Modal title="Hangi araç için?" onClose={close} width="max-w-md">
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {vehicles.map((v) => (
              <li key={v.id} data-accent={FUEL_ACCENT[v.fuelType]} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setVehicleId(v.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                    <Car size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{v.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{FUEL_TYPE_LABELS[v.fuelType]}</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {open && vehicle && !kind ? (
        <Modal title={`${vehicle.name} · Ne eklemek istersiniz?`} onClose={close} width="max-w-md" accent={accent}>
          <div className="grid gap-2">
            {ACTIONS.map(({ kind: k, label, hint, icon: Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-brand-900/20"
              >
                <span className="rounded-lg bg-brand-600 p-2 text-white">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {open && vehicle && kind ? (
        <Modal
          title={`${vehicle.name} · ${ACTIONS.find((a) => a.kind === kind)!.label}`}
          onClose={close}
          width="max-w-2xl"
          accent={accent}
        >
          {kind === "entry" ? (
            <EntryForm
              vehicleId={vehicle.id}
              tankCapacity={vehicle.tankCapacity}
              otherEntries={vehicleEntries}
              onCancel={close}
              onAdd={async (input) => {
                await onAddEntry(input);
                close();
              }}
            />
          ) : kind === "expense" ? (
            <ExpenseForm
              vehicleId={vehicle.id}
              onCancel={close}
              onAdd={async (input) => {
                await onAddExpense(input);
                close();
              }}
            />
          ) : (
            <ReminderForm
              vehicleId={vehicle.id}
              latestKm={latestKm}
              onCancel={close}
              onSubmit={async (input) => {
                await onAddReminder(input);
                close();
              }}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
}
