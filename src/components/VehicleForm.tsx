import { useState } from "react";
import { errorMessage } from "../lib/api";
import { FUEL_TYPE_LABELS } from "../lib/format";
import type { FuelType, Vehicle, VehicleInput } from "../types";

interface Props {
  initial?: Vehicle;
  submitLabel: string;
  onSubmit: (vehicle: VehicleInput) => Promise<void>;
  onCancel?: () => void;
}

export default function VehicleForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(initial?.fuelType ?? "benzin");
  const [tankCapacity, setTankCapacity] = useState(initial?.tankCapacity ? String(initial.tankCapacity) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim() || [brand.trim(), model.trim()].filter(Boolean).join(" ");
    if (!trimmedName) return setError("Araca bir ad verin veya marka/model girin.");

    const parsedYear = Number(year);
    if (year && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100)) {
      return setError("Geçerli bir model yılı girin.");
    }
    const parsedTank = Number(tankCapacity.replace(",", "."));
    if (tankCapacity && !(parsedTank >= 5 && parsedTank <= 300)) {
      return setError("Depo hacmi 5-300 litre arasında olmalı.");
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        year: year ? parsedYear : undefined,
        plate: plate.trim().toLocaleUpperCase("tr-TR") || undefined,
        fuelType,
        tankCapacity: tankCapacity ? parsedTank : undefined,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
    >
      <Field label="Araç Adı">
        <input
          type="text"
          placeholder="Aile arabası"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          autoFocus={!initial}
        />
      </Field>

      <Field label="Plaka (opsiyonel)">
        <input
          type="text"
          placeholder="34 ABC 123"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          className="input uppercase"
        />
      </Field>

      <Field label="Marka">
        <input
          type="text"
          placeholder="Toyota"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Model">
        <input
          type="text"
          placeholder="Corolla"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Model Yılı">
        <input
          type="number"
          inputMode="numeric"
          placeholder="2019"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Yakıt Türü">
        <select
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value as FuelType)}
          className="input"
        >
          {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Depo Hacmi (L, opsiyonel)">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="50"
          value={tankCapacity}
          onChange={(e) => setTankCapacity(e.target.value)}
          className="input"
        />
      </Field>
      <p className="self-end text-xs text-slate-500 dark:text-slate-400 sm:col-span-1">
        Depoyu her seferinde fullemiyorsanız, gösterge ile tüketim tahmini için gerekir (ruhsat veya kullanım
        kılavuzunda yazar).
      </p>

      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
        <div className="flex gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Vazgeç
            </button>
          ) : null}
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
