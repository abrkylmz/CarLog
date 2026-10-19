import { useState } from "react";
import { Camera, ChevronDown, Pencil, Trash2, Wrench } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { EXPENSE_CATEGORY_LABELS, formatDate, formatNumber, formatTL } from "../lib/format";
import type { Expense, ExpenseInput } from "../types";
import EmptyState from "./EmptyState";
import ExpenseForm, { SERVICE_CATEGORIES } from "./ExpenseForm";
import Modal from "./Modal";
import PendingBadge from "./PendingBadge";

interface Props {
  vehicleId: string;
  expenses: Expense[];
  latestKm: number | null;
  onAdd: (expense: ExpenseInput) => Promise<void>;
  onEdit: (expense: Expense) => void;
  onDelete?: (id: string) => void;
  canEdit: (expense: Expense) => boolean;
}

/**
 * The maintenance log ("Bakım Defteri"): every service, tyre and inspection visit with the garage,
 * odometer, work done and invoice photo, newest first. Useful on its own and when selling the car.
 */
export default function ServiceLog({ vehicleId, expenses, latestKm, onAdd, onEdit, onDelete, canEdit }: Props) {
  const [adding, setAdding] = useState(false);
  const [photo, setPhoto] = useState<{ title: string; src: string | null; error?: string } | null>(null);

  const visits = expenses
    .filter((x) => SERVICE_CATEGORIES.includes(x.category) || x.details)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.details?.km ?? 0) - (a.details?.km ?? 0));
  const lastService = visits.find((v) => v.category === "bakim");
  const lastKm = lastService?.details?.km;
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const yearSpend = visits.filter((v) => v.date >= yearAgo).reduce((t, v) => t + v.amount, 0);

  async function showPhoto(expense: Expense) {
    const title = `${EXPENSE_CATEGORY_LABELS[expense.category]} · ${formatDate(expense.date)}`;
    setPhoto({ title, src: null });
    try {
      setPhoto({ title, src: (await api.expensePhoto(expense.id)).image });
    } catch (err) {
      setPhoto({ title, src: null, error: errorMessage(err) });
    }
  }

  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fact label="Son bakım" value={lastService ? formatDate(lastService.date) : "—"} hint={lastKm != null ? `${formatNumber(lastKm, 0)} km'de` : undefined} />
        <Fact
          label="Son bakımdan beri"
          value={lastKm != null && latestKm != null && latestKm >= lastKm ? `${formatNumber(latestKm - lastKm, 0)} km` : "—"}
          hint={lastKm == null ? "Bakımın kilometresini girince hesaplanır" : undefined}
        />
        <Fact label="Son 12 ayda bakım" value={formatTL(yearSpend)} hint={`${visits.filter((v) => v.date >= yearAgo).length} kayıt`} />
      </section>

      <section className="mb-6">
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          <Wrench size={16} />
          Bakım Ekle
          <ChevronDown size={16} className={`transition ${adding ? "rotate-180" : ""}`} />
        </button>
        {adding ? (
          <ExpenseForm
            vehicleId={vehicleId}
            defaultCategory="bakim"
            submitLabel="Bakımı Kaydet"
            onAdd={async (input) => {
              await onAdd(input);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </section>

      {visits.length === 0 ? (
        <EmptyState icon={Wrench} title="Bakım defteri boş" text="Bakım, lastik ve muayene kayıtları servis bilgileri ve fatura fotoğrafıyla burada birikir." />
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-slate-200 pl-5 dark:border-slate-800">
          {visits.map((v) => (
            <li key={v.id} className="card relative p-4">
              <span className="absolute -left-[1.72rem] top-5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-950" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {EXPENSE_CATEGORY_LABELS[v.category]} <PendingBadge id={v.id} />
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {[formatDate(v.date), v.details?.km != null ? `${formatNumber(v.details.km, 0)} km` : null, v.details?.shop].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-1 font-semibold tabular-nums">{formatTL(v.amount)}</span>
                  {canEdit(v) ? (
                    <button type="button" onClick={() => onEdit(v)} aria-label="Kaydı düzenle" className="tap rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                      <Pencil size={16} />
                    </button>
                  ) : null}
                  {onDelete && canEdit(v) ? (
                    <button type="button" onClick={() => onDelete(v.id)} aria-label="Kaydı sil" className="tap rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              {v.details?.items?.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {v.details.items.map((item) => (
                    <li key={item} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {v.note ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{v.note}</p> : null}
              {v.hasPhoto ? (
                <button type="button" onClick={() => showPhoto(v)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                  <Camera size={15} />
                  Faturayı gör
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {photo ? (
        <Modal title={photo.title} onClose={() => setPhoto(null)} width="max-w-2xl">
          {photo.src ? (
            <img src={photo.src} alt={`${photo.title} faturası`} className="mx-auto max-h-[75vh] rounded-xl" />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{photo.error ?? "Yükleniyor…"}</p>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}
