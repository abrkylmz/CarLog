import { useMemo, useState } from "react";
import { Car, Pencil, Trash2 } from "lucide-react";
import BackLink from "../components/BackLink";
import CategoryBreakdown from "../components/CategoryBreakdown";
import EntryForm from "../components/EntryForm";
import EntryTable from "../components/EntryTable";
import ExpenseForm from "../components/ExpenseForm";
import ExpenseList from "../components/ExpenseList";
import MonthlySummaryTable from "../components/MonthlySummaryTable";
import SpendChart from "../components/SpendChart";
import StatCard from "../components/StatCard";
import VehicleForm from "../components/VehicleForm";
import { groupByMonth, vehicleStats, withDerived } from "../lib/calc";
import { FUEL_TYPE_LABELS, formatDate, formatNumber, formatTL, vehicleSubtitle } from "../lib/format";
import { paths, VEHICLE_TAB_LABELS, VEHICLE_TABS, type VehicleTab } from "../lib/router";
import type { Expense, ExpenseInput, FuelEntry, FuelEntryInput, Vehicle, VehicleInput } from "../types";

interface Props {
  vehicle: Vehicle;
  entries: FuelEntry[];
  expenses: Expense[];
  tab: VehicleTab;
  onAddEntry: (entry: FuelEntryInput) => Promise<void>;
  onAddExpense: (expense: ExpenseInput) => Promise<void>;
  onUpdateVehicle: (id: string, input: VehicleInput) => Promise<void>;
  /** Delete handlers are only passed for admins. */
  onDeleteEntry?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteVehicle?: (id: string) => void;
}

export default function VehiclePage({
  vehicle,
  entries,
  expenses,
  tab,
  onAddEntry,
  onAddExpense,
  onDeleteEntry,
  onDeleteExpense,
  onUpdateVehicle,
  onDeleteVehicle,
}: Props) {
  const derived = useMemo(() => withDerived(entries), [entries]);
  const summaries = useMemo(() => groupByMonth(entries, expenses), [entries, expenses]);
  const stats = useMemo(() => vehicleStats(entries, expenses), [entries, expenses]);
  const thisMonthTotal = stats.thisMonthCost + stats.thisMonthOtherCost;
  const grandTotal = stats.totalCost + stats.otherCostTotal;
  const split = (fuel: number, other: number) => `Yakıt ${formatTL(fuel)} · Diğer ${formatTL(other)}`;
  const subtitle = vehicleSubtitle(vehicle);

  return (
    <>
      <BackLink />

      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Car size={26} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{vehicle.name}</h2>
            {vehicle.plate ? (
              <span className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                {vehicle.plate}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[subtitle, FUEL_TYPE_LABELS[vehicle.fuelType]].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {VEHICLE_TABS.map((t) => (
          <a
            key={t}
            href={paths.vehicle(vehicle.id, t)}
            aria-current={t === tab ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              t === tab
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {VEHICLE_TAB_LABELS[t]}
          </a>
        ))}
      </nav>

      {tab === "ozet" && (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Bu Ay Toplam"
              value={formatTL(thisMonthTotal)}
              hint={split(stats.thisMonthCost, stats.thisMonthOtherCost)}
            />
            <StatCard label="Genel Toplam" value={formatTL(grandTotal)} hint={split(stats.totalCost, stats.otherCostTotal)} />
            <StatCard
              label="Ort. Tüketim"
              value={
                stats.avgConsumptionPer100km != null
                  ? `${formatNumber(stats.avgConsumptionPer100km, 1)} L/100km`
                  : "—"
              }
              hint={stats.kmTracked > 0 ? `${formatNumber(stats.kmTracked, 0)} km üzerinden` : undefined}
            />
            <StatCard
              label="Ortalama TL/L"
              value={stats.avgPricePerLiter > 0 ? formatNumber(stats.avgPricePerLiter, 2) : "—"}
              hint={`${formatNumber(stats.totalLiters)} L toplam`}
            />
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Son Kilometre"
              value={stats.latestOdometerKm != null ? `${formatNumber(stats.latestOdometerKm, 0)} km` : "—"}
            />
            <StatCard
              label="Son Dolum"
              value={stats.lastFillDate ? formatDate(stats.lastFillDate) : "—"}
            />
            <StatCard
              label="Diğer Masraflar"
              value={formatTL(stats.otherCostTotal)}
              hint={stats.expenseCount > 0 ? `${stats.expenseCount} kayıt` : "Henüz masraf yok"}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Aylık Harcama</h3>
            <SpendChart summaries={summaries} />
          </section>
        </>
      )}

      {tab === "dolumlar" && (
        <>
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Dolum Ekle</h3>
            <EntryForm vehicleId={vehicle.id} onAdd={onAddEntry} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Kayıtlar</h3>
            <EntryTable entries={derived} onDelete={onDeleteEntry} />
          </section>
        </>
      )}

      {tab === "masraflar" && (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Bu Ay Masraf" value={formatTL(stats.thisMonthOtherCost)} hint="Yakıt hariç" />
            <StatCard
              label="Bu Ay Toplam"
              value={formatTL(thisMonthTotal)}
              hint={split(stats.thisMonthCost, stats.thisMonthOtherCost)}
            />
            <StatCard
              label="Toplam Masraf"
              value={formatTL(stats.otherCostTotal)}
              hint={`${stats.expenseCount} kayıt · yakıt hariç`}
            />
            <StatCard label="Genel Toplam" value={formatTL(grandTotal)} hint="Yakıt + diğer masraflar" />
          </section>

          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Masraf Ekle</h3>
            <ExpenseForm vehicleId={vehicle.id} onAdd={onAddExpense} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Masraflar</h3>
              <ExpenseList expenses={expenses} onDelete={onDeleteExpense} />
            </section>
            {expenses.length > 0 ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Türlere Göre</h3>
                <CategoryBreakdown expenses={expenses} />
              </section>
            ) : null}
          </div>
        </>
      )}

      {tab === "aylik" && (
        <section>
          <div className="mb-4">
            <SpendChart summaries={summaries} />
          </div>
          <MonthlySummaryTable summaries={summaries} />
        </section>
      )}

      {tab === "bilgiler" && (
        <VehicleSettings
          vehicle={vehicle}
          recordCount={entries.length + expenses.length}
          onUpdate={onUpdateVehicle}
          onDelete={onDeleteVehicle}
        />
      )}
    </>
  );
}

function VehicleSettings({
  vehicle,
  recordCount,
  onUpdate,
  onDelete,
}: {
  vehicle: Vehicle;
  recordCount: number;
  onUpdate: (id: string, input: VehicleInput) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  const [saved, setSaved] = useState(false);

  function handleDelete() {
    const message =
      recordCount > 0
        ? `"${vehicle.name}" ve ona ait ${recordCount} dolum/masraf kaydı silinecek. Emin misiniz?`
        : `"${vehicle.name}" silinecek. Emin misiniz?`;
    if (window.confirm(message)) onDelete?.(vehicle.id);
  }

  return (
    <>
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Pencil size={14} />
          Bilgileri Düzenle
          {saved ? <span className="ml-2 font-normal text-emerald-600 dark:text-emerald-400">Kaydedildi</span> : null}
        </h3>
        <VehicleForm
          key={vehicle.id}
          initial={vehicle}
          submitLabel="Kaydet"
          onSubmit={async (input) => {
            setSaved(false);
            await onUpdate(vehicle.id, input);
            setSaved(true);
          }}
        />
      </section>

      {onDelete ? (
        <section className="rounded-xl border border-red-200 p-4 dark:border-red-900/60">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Aracı Sil</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Araç ve tüm dolum/masraf kayıtları kalıcı olarak silinir.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 size={14} />
            Aracı Sil
          </button>
        </section>
      ) : null}
    </>
  );
}
