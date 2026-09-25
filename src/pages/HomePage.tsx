import { useMemo } from "react";
import { Car, Download, Plus } from "lucide-react";
import LegacyImportBanner from "../components/LegacyImportBanner";
import StatCard from "../components/StatCard";
import UpcomingReminders from "../components/UpcomingReminders";
import VehicleCard from "../components/VehicleCard";
import { vehicleStats } from "../lib/calc";
import { formatTL } from "../lib/format";
import { paths } from "../lib/router";
import { reminderStatus } from "../lib/reminders";
import type { Expense, FuelEntry, Reminder, Vehicle } from "../types";

interface Props {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
  isAdmin: boolean;
  onReload: () => void;
  onExport: () => void;
}

export default function HomePage({ vehicles, entries, expenses, reminders, isAdmin, onReload, onExport }: Props) {
  const statsByVehicle = useMemo(
    () =>
      new Map(
        vehicles.map((v) => [
          v.id,
          vehicleStats(
            entries.filter((e) => e.vehicleId === v.id),
            expenses.filter((e) => e.vehicleId === v.id),
          ),
        ]),
      ),
    [vehicles, entries, expenses],
  );
  const overall = useMemo(() => vehicleStats(entries, expenses), [entries, expenses]);
  const latestKmByVehicle = useMemo(
    () => new Map([...statsByVehicle].map(([id, s]) => [id, s.latestOdometerKm])),
    [statsByVehicle],
  );
  const alertsByVehicle = useMemo(() => {
    const counts = new Map<string, { overdue: number; soon: number }>();
    for (const r of reminders) {
      const level = reminderStatus(r, latestKmByVehicle.get(r.vehicleId) ?? null).level;
      if (level !== "overdue" && level !== "soon") continue;
      const c = counts.get(r.vehicleId) ?? { overdue: 0, soon: 0 };
      c[level] += 1;
      counts.set(r.vehicleId, c);
    }
    return counts;
  }, [reminders, latestKmByVehicle]);
  const split = (fuel: number, other: number) => `Yakıt ${formatTL(fuel)} · Diğer ${formatTL(other)}`;
  const banner = isAdmin ? <LegacyImportBanner onImported={onReload} /> : null;

  if (vehicles.length === 0) {
    return (
      <>
        {banner}
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700">
          <div className="mb-4 rounded-full bg-brand-50 p-4 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <Car size={32} />
          </div>
          <h2 className="text-lg font-semibold">Garajınız boş</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Yakıt giderlerini takip etmeye başlamak için ilk aracınızı ekleyin.
          </p>
          <a
            href={paths.newVehicle}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            Araç Ekle
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      {banner}
      <UpcomingReminders reminders={reminders} vehicles={vehicles} latestKmByVehicle={latestKmByVehicle} />
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Bu Ay Toplam"
          value={formatTL(overall.thisMonthCost + overall.thisMonthOtherCost)}
          hint={split(overall.thisMonthCost, overall.thisMonthOtherCost)}
        />
        <StatCard
          label="Genel Toplam"
          value={formatTL(overall.totalCost + overall.otherCostTotal)}
          hint={split(overall.totalCost, overall.otherCostTotal)}
        />
        <StatCard
          label="Diğer Masraflar"
          value={formatTL(overall.otherCostTotal)}
          hint={`${overall.expenseCount} kayıt · yakıt hariç`}
        />
        <StatCard label="Araç Sayısı" value={String(vehicles.length)} hint={`${overall.fillCount} dolum`} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Araçlarım</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download size={16} />
              Dışa Aktar
            </button>
            <a
              href={paths.newVehicle}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30"
            >
              <Plus size={16} />
              Araç Ekle
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              stats={statsByVehicle.get(vehicle.id)!}
              alerts={alertsByVehicle.get(vehicle.id)}
            />
          ))}
          <a
            href={paths.newVehicle}
            className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            <Plus size={24} />
            Yeni araç ekle
          </a>
        </div>
      </section>
    </>
  );
}
