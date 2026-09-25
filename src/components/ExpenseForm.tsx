import { useState } from "react";
import { errorMessage } from "../lib/api";
import { EXPENSE_CATEGORY_LABELS } from "../lib/format";
import type { ExpenseCategory, ExpenseInput } from "../types";

interface Props {
  vehicleId: string;
  onAdd: (expense: ExpenseInput) => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parse(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function ExpenseForm({ vehicleId, onAdd }: Props) {
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<ExpenseCategory>("bakim");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parse(amount);
    if (value <= 0) return setError("Tutar değeri girin.");

    setError(null);
    setSubmitting(true);
    try {
      await onAdd({ vehicleId, date, category, amount: value, note: note.trim() || undefined });
      // Keep date and category: several costs from the same visit are often entered in a row.
      setAmount("");
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4"
    >
      <Field label="Tarih">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
      </Field>

      <Field label="Masraf Türü">
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="input">
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tutar (TL)">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="2500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
          required
        />
      </Field>

      <Field label="Not (opsiyonel)">
        <input
          type="text"
          placeholder="Yağ + filtre değişimi…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
        />
      </Field>

      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Kaydediliyor…" : "Masrafı Ekle"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
