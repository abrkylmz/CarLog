import { useMemo, useState } from "react";
import { Fuel } from "lucide-react";
import EntryForm from "./components/EntryForm";
import EntryTable from "./components/EntryTable";
import MonthlySummaryTable from "./components/MonthlySummaryTable";
import SpendChart from "./components/SpendChart";
import StatCard from "./components/StatCard";
import { groupByMonth, monthKey, withDerived } from "./lib/calc";
import { formatNumber, formatTL } from "./lib/format";
import { loadEntries, saveEntries } from "./lib/storage";
import type { FuelEntry } from "./types";

export default function App() {
  const [entries, setEntries] = useState<FuelEntry[]>(() => loadEntries());

  const derived = useMemo(() => withDerived(entries), [entries]);
  const summaries = useMemo(() => groupByMonth(entries), [entries]);

  const currentMonthKey = monthKey(new Date().toISOString());
  const currentMonth = summaries.find((s) => s.month === currentMonthKey);

  const allTimeTotal = entries.reduce((sum, e) => sum + e.totalCost, 0);
  const allTimeLiters = entries.reduce((sum, e) => sum + e.liters, 0);
  const avgPricePerLiter = allTimeLiters > 0 ? allTimeTotal / allTimeLiters : 0;

  function addEntry(entry: FuelEntry) {
    const next = [...entries, entry];
    setEntries(next);
    saveEntries(next);
  }

  function deleteEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveEntries(next);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center gap-2">
        <div className="rounded-lg bg-brand-600 p-2 text-white">
          <Fuel size={20} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">CarLog</h1>
        <span className="text-sm text-slate-500 dark:text-slate-400">Yakıt gideri takibi</span>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Bu Ay Toplam"
          value={formatTL(currentMonth?.totalCost ?? 0)}
          hint={currentMonth ? `${currentMonth.fillCount} dolum` : "Henüz dolum yok"}
        />
        <StatCard label="Toplam Gider" value={formatTL(allTimeTotal)} hint={`${entries.length} kayıt`} />
        <StatCard label="Toplam Litre" value={`${formatNumber(allTimeLiters)} L`} />
        <StatCard
          label="Ortalama TL/L"
          value={avgPricePerLiter > 0 ? formatNumber(avgPricePerLiter, 2) : "—"}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Dolum Ekle</h2>
        <EntryForm onAdd={addEntry} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Kayıtlar</h2>
        <EntryTable entries={derived} onDelete={deleteEntry} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Aylık Özet</h2>
        <div className="mb-4">
          <SpendChart summaries={summaries} />
        </div>
        <MonthlySummaryTable summaries={summaries} />
      </section>
    </div>
  );
}
