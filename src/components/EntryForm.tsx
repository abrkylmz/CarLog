import { useState } from "react";
import { errorMessage } from "../lib/api";
import { fillUpWarnings, GAUGE_OPTIONS } from "../lib/consumption";
import type { FuelEntry, FuelEntryInput } from "../types";
import { useDialog } from "./DialogProvider";

interface Props {
  vehicleId: string;
  onAdd: (entry: FuelEntryInput) => Promise<void>;
  /** The vehicle's tank size, for the gauge hint and the "more than a tankful" check. */
  tankCapacity?: number;
  /** The vehicle's other fill-ups, for the odometer sanity checks. */
  otherEntries?: FuelEntry[];
  /** Edit mode: fields start from this record and aren't cleared after saving. */
  initial?: FuelEntry;
  submitLabel?: string;
  onCancel?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parse(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function EntryForm({
  vehicleId,
  onAdd,
  tankCapacity,
  otherEntries = [],
  initial,
  submitLabel = "Kaydı Ekle",
  onCancel,
}: Props) {
  const dialog = useDialog();
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [odometerKm, setOdometerKm] = useState(initial ? String(initial.odometerKm) : "");
  const [liters, setLiters] = useState(initial ? String(initial.liters) : "");
  const [pricePerLiter, setPricePerLiter] = useState(initial ? String(Number(initial.pricePerLiter.toFixed(3))) : "");
  const [totalCost, setTotalCost] = useState(initial ? String(initial.totalCost) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  // Most fill-ups are full, so new ones start checked; untick for a partial fill.
  const [isFull, setIsFull] = useState(initial?.isFull ?? true);
  const [gauge, setGauge] = useState(initial?.gaugeBefore != null ? String(initial.gaugeBefore) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The pump receipt shows price and total, so liters is derived from those
  // whenever both are known; the other directions only fill a missing field.
  function handlePriceChange(value: string) {
    setPricePerLiter(value);
    const p = parse(value);
    const t = parse(totalCost);
    const l = parse(liters);
    if (p > 0 && t > 0) setLiters((t / p).toFixed(2));
    else if (p > 0 && l > 0) setTotalCost((l * p).toFixed(2));
  }

  function handleTotalCostChange(value: string) {
    setTotalCost(value);
    const t = parse(value);
    const p = parse(pricePerLiter);
    const l = parse(liters);
    if (t > 0 && p > 0) setLiters((t / p).toFixed(2));
    else if (t > 0 && l > 0) setPricePerLiter((t / l).toFixed(3));
  }

  function handleLitersChange(value: string) {
    setLiters(value);
    const l = parse(value);
    const p = parse(pricePerLiter);
    const t = parse(totalCost);
    if (l > 0 && p > 0) setTotalCost((l * p).toFixed(2));
    else if (l > 0 && t > 0) setPricePerLiter((t / l).toFixed(3));
  }

  function reset() {
    setDate(todayIso());
    setOdometerKm("");
    setLiters("");
    setPricePerLiter("");
    setTotalCost("");
    setNote("");
    setIsFull(true);
    setGauge("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const km = parse(odometerKm);
    const l = parse(liters);
    const p = parse(pricePerLiter);
    const t = parse(totalCost);

    if (km <= 0) return setError("Kilometre değeri girin.");
    if (l <= 0) return setError("Litre değeri girin.");
    if (t <= 0) return setError("Tutar değeri girin.");

    setError(null);
    const warnings = fillUpWarnings(
      { date, odometerKm: km, liters: l },
      otherEntries.filter((o) => o.id !== initial?.id),
      tankCapacity,
    );
    if (warnings.length > 0) {
      const proceed = await dialog.confirm({
        title: "Bu dolumu kontrol edin",
        message: (
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ),
        tone: "danger",
        confirmLabel: "Yine de Kaydet",
        cancelLabel: "Düzelt",
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      await onAdd({
        vehicleId,
        date,
        odometerKm: km,
        liters: l,
        pricePerLiter: p > 0 ? p : t / l,
        totalCost: t,
        isFull,
        gaugeBefore: !isFull && gauge ? Number(gauge) : undefined,
        note: note.trim() || undefined,
      });
      if (!initial) reset();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
    >
      <Field label="Tarih">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          required
        />
      </Field>

      <Field label="Kilometre (km)">
        <input
          type="number"
          inputMode="decimal"
          placeholder="125000"
          value={odometerKm}
          onChange={(e) => setOdometerKm(e.target.value)}
          className="input"
          required
        />
      </Field>

      <Field label="Litre Fiyatı (TL/L)">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="44.90"
          value={pricePerLiter}
          onChange={(e) => handlePriceChange(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Toplam Tutar (TL)">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="1594.00"
          value={totalCost}
          onChange={(e) => handleTotalCostChange(e.target.value)}
          className="input"
          required
        />
      </Field>

      <Field label="Litre (L) · otomatik">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="Tutar ÷ fiyat"
          value={liters}
          onChange={(e) => handleLitersChange(e.target.value)}
          className="input"
          required
        />
      </Field>

      <div className="col-span-full flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50 sm:flex-row sm:items-center sm:gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={isFull}
            onChange={(e) => setIsFull(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 accent-brand-600"
          />
          Depo fullendi
        </label>
        {isFull ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Tüketim iki full dolum arasında kesin olarak hesaplanır.
          </span>
        ) : (
          <label className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-slate-600 dark:text-slate-300">Dolumdan önce gösterge:</span>
            <select value={gauge} onChange={(e) => setGauge(e.target.value)} className="input sm:w-56">
              <option value="">Bilmiyorum</option>
              {GAUGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!tankCapacity ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Göstergeden tahmin için Araç Bilgileri'ne depo hacmini girin.
              </span>
            ) : null}
          </label>
        )}
      </div>

      <Field label="Not (opsiyonel)">
        <input
          type="text"
          placeholder="Shell, otoyol dönüşü…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
        />
      </Field>

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

export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Vazgeç
    </button>
  );
}
