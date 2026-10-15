import { useState } from "react";
import { Camera, X } from "lucide-react";
import { errorMessage } from "../lib/api";
import { EXPENSE_CATEGORY_LABELS } from "../lib/format";
import { compressImage } from "../lib/image";
import type { Expense, ExpenseCategory, ExpenseInput, ServiceDetails } from "../types";

/** Expense kinds that belong in the maintenance log and get the service fields. */
export const SERVICE_CATEGORIES: ExpenseCategory[] = ["bakim", "lastik", "muayene"];
import { CancelButton } from "./EntryForm";

interface Props {
  vehicleId: string;
  onAdd: (expense: ExpenseInput) => Promise<void>;
  /** Edit mode: fields start from this record and aren't cleared after saving. */
  initial?: Expense;
  submitLabel?: string;
  onCancel?: () => void;
  /** Category for a new expense (e.g. "bakim" from the maintenance log). */
  defaultCategory?: ExpenseCategory;
}

/** Today on the user's own calendar (toISOString would give yesterday's date after midnight in Turkey). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parse(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function ExpenseForm({ vehicleId, onAdd, initial, submitLabel = "Masrafı Ekle", onCancel, defaultCategory }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? defaultCategory ?? "bakim");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [shop, setShop] = useState(initial?.details?.shop ?? "");
  const [km, setKm] = useState(initial?.details?.km != null ? String(initial.details.km) : "");
  const [items, setItems] = useState((initial?.details?.items ?? []).join(", "));
  /** New photo as a data URL, null = remove the existing one, undefined = leave it as is. */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const hadPhoto = Boolean(initial?.hasPhoto) && photo !== null;
  const service = SERVICE_CATEGORIES.includes(category) || Boolean(initial?.details);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parse(amount);
    if (value <= 0) return setError("Tutar değeri girin.");

    setError(null);
    setSubmitting(true);
    try {
      let details: ServiceDetails | undefined;
      if (service) {
        const list = items.split(/[,\n]/).map((i) => i.trim()).filter(Boolean).slice(0, 20);
        const kmValue = km.trim() ? parse(km) : undefined;
        details = { shop: shop.trim() || undefined, km: kmValue && kmValue > 0 ? kmValue : undefined, items: list.length ? list : undefined };
        if (!details.shop && !details.km && !details.items) details = undefined;
      }
      await onAdd({ vehicleId, date, category, amount: value, note: note.trim() || undefined, details, photo });
      if (!initial) {
        // Keep date and category: several costs from the same visit are often entered in a row.
        setAmount("");
        setNote("");
        setShop("");
        setKm("");
        setItems("");
        setPhoto(undefined);
      }
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
        <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="input" required />
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

      {service ? (
        <fieldset className="col-span-full grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4 dark:bg-slate-800/50">
          <legend className="sr-only">Servis bilgileri</legend>
          <p className="col-span-full -mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Bakım Defteri için (opsiyonel)
          </p>
          <Field label="Servis / firma">
            <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Yetkili servis, usta…" className="input" />
          </Field>
          <Field label="Kilometre">
            <input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="85000" className="input" />
          </Field>
          <div className="col-span-2">
            <Field label="Yapılanlar (virgülle ayırın)">
              <input value={items} onChange={(e) => setItems(e.target.value)} placeholder="Yağ değişimi, yağ filtresi, ön balata" className="input" />
            </Field>
          </div>
          <div className="col-span-full flex flex-wrap items-center gap-3 text-sm">
            {photo ? (
              <span className="relative">
                <img src={photo} alt="Fatura fotoğrafı" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                <button type="button" onClick={() => setPhoto(initial?.hasPhoto ? null : undefined)} aria-label="Fotoğrafı kaldır" className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-0.5 text-white">
                  <X size={12} />
                </button>
              </span>
            ) : hadPhoto ? (
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                Fatura fotoğrafı ekli
                <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-600 hover:underline">
                  Kaldır
                </button>
              </span>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium transition hover:border-brand-400 dark:border-slate-600 dark:bg-slate-900">
              <Camera size={16} />
              {photo || hadPhoto ? "Fotoğrafı değiştir" : "Fatura fotoğrafı ekle"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    setPhoto(await compressImage(file));
                    setError(null);
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
              />
            </label>
          </div>
        </fieldset>
      ) : null}

      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
        <div className="flex gap-2">
          {onCancel ? <CancelButton onClick={onCancel} /> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Kaydediliyor…" : submitLabel}
          </button>
        </div>
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
