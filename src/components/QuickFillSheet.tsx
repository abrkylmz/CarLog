import { useState } from "react";
import { ChevronDown, Delete } from "lucide-react";
import { errorMessage } from "../lib/api";
import { fillUpWarnings, GAUGE_OPTIONS } from "../lib/consumption";
import { formatNumber, formatTL, parseAmount } from "../lib/format";
import type { EntryFuel, FuelEntry, FuelEntryInput, Vehicle } from "../types";
import { useDialog } from "./DialogProvider";

interface Props {
  vehicle: Vehicle;
  /** This vehicle's fill-ups: last price, last amount and the sanity checks come from them. */
  entries: FuelEntry[];
  onAdd: (entry: FuelEntryInput) => Promise<void>;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Reads "1.250,50", "44,90" or "44.90" the way people type them; 0 when it isn't a number. */
const parse = (text: string) => {
  const n = parseAmount(text);
  return Number.isFinite(n) ? n : 0;
};

/** "1250,5" → "1.250,5" while typing (thousands dots, the comma kept as typed). */
function showAmount(typed: string): string {
  if (!typed) return "0";
  const [whole, fraction] = typed.split(",");
  const grouped = Number(whole || "0").toLocaleString("tr-TR");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

/**
 * Phone fill-up entry for use at the pump, one-handed: the amount on a big keypad, the last price
 * per liter ready, common amounts one tap away. Odometer, date and notes wait under "Ayrıntılar".
 */
export default function QuickFillSheet({ vehicle, entries, onAdd }: Props) {
  const dialog = useDialog();
  const dualFuel = vehicle.fuelType === "benzin-lpg";
  const byDate = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const [fuel, setFuel] = useState<EntryFuel>(byDate.find((e) => e.fuel)?.fuel ?? "lpg");
  const lastOf = (f: EntryFuel | null) => byDate.find((e) => !dualFuel || !f || e.fuel === f);
  const last = lastOf(dualFuel ? fuel : null);

  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(last ? formatNumber(last.pricePerLiter, 2) : "");
  const [editingPrice, setEditingPrice] = useState(!last);
  const [isFull, setIsFull] = useState(true);
  const [details, setDetails] = useState(false);
  const [km, setKm] = useState("");
  const [date, setDate] = useState(todayIso());
  const [gauge, setGauge] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = parse(amount);
  const perLiter = parse(price);
  const liters = total > 0 && perLiter > 0 ? total / perLiter : 0;

  function press(key: (typeof KEYS)[number]) {
    setError(null);
    setAmount((a) => {
      if (key === "back") return a.slice(0, -1);
      if (key === ",") return a.includes(",") ? a : (a || "0") + ",";
      if (a.includes(",") && a.split(",")[1].length >= 2) return a;
      if (a.replace(",", "").length >= 7) return a;
      return a === "0" ? key : a + key;
    });
  }

  function switchFuel(f: EntryFuel) {
    setFuel(f);
    const prev = lastOf(f);
    if (prev) {
      setPrice(formatNumber(prev.pricePerLiter, 2));
      setEditingPrice(false);
    }
  }

  async function save() {
    if (!(total > 0)) return setError("Tutarı girin.");
    if (!(perLiter > 0)) {
      setEditingPrice(true);
      return setError("Litre fiyatını girin.");
    }
    const odometerKm = km.trim() ? parse(km) : null;
    if (odometerKm != null && !(odometerKm > 0)) return setError("Geçerli bir kilometre girin ya da boş bırakın.");

    const warnings = fillUpWarnings({ date, odometerKm, liters }, entries, vehicle.tankCapacity);
    if (warnings.length) {
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
    setSaving(true);
    try {
      await onAdd({
        vehicleId: vehicle.id,
        date,
        odometerKm,
        liters: Math.round(liters * 100) / 100,
        pricePerLiter: perLiter,
        totalCost: total,
        isFull,
        gaugeBefore: !isFull && gauge ? Number(gauge) : undefined,
        fuel: dualFuel ? fuel : undefined,
        note: note.trim() || undefined,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const chips: { label: string; value: number }[] = [
    { label: "₺500", value: 500 },
    { label: "₺1.000", value: 1000 },
    { label: "₺1.500", value: 1500 },
    ...(last ? [{ label: "Son tutar", value: last.totalCost }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {dualFuel ? (
        <div role="radiogroup" aria-label="Yakıt" className="grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 text-sm dark:bg-slate-800">
          {(["lpg", "benzin"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fuel === f}
              onClick={() => switchFuel(f)}
              className={`rounded-lg py-1.5 font-semibold transition ${fuel === f ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300" : "text-slate-500"}`}
            >
              {f === "lpg" ? "LPG" : "Benzin"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white px-4 pb-3 pt-4 text-center shadow-sm dark:bg-slate-900">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Toplam tutar</p>
        <p
          aria-live="polite"
          data-autofocus
          tabIndex={-1}
          className={`mt-1 text-4xl font-extrabold tabular-nums tracking-tight outline-none ${amount ? "" : "text-slate-300 dark:text-slate-600"}`}
        >
          ₺{showAmount(amount)}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {editingPrice ? (
            <label className="flex items-center gap-1.5">
              <span>Litre fiyatı</span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="44,90"
                autoFocus={!last}
                className="input w-24 py-1 text-center"
              />
            </label>
          ) : (
            <button type="button" onClick={() => setEditingPrice(true)} className="rounded-lg bg-brand-50 px-2 py-1 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {formatNumber(perLiter, 2)} TL/L · değiştir
            </button>
          )}
          {liters > 0 ? <span className="tabular-nums">≈ {formatNumber(liters, 1)} L</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setAmount(formatNumber(c.value, 2).replace(/\./g, ""))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {c.label}
            {c.label === "Son tutar" ? <span className="ml-1 font-normal text-slate-500">{formatTL(c.value).replace(",00", "")}</span> : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "back" ? "Sil" : k === "," ? "Virgül" : k}
            className="flex h-12 items-center justify-center rounded-xl bg-white text-xl font-semibold shadow-sm transition active:bg-slate-200 dark:bg-slate-900 dark:active:bg-slate-800"
          >
            {k === "back" ? <Delete size={20} /> : k}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium shadow-sm dark:bg-slate-900">
        Depo fullendi
        <input type="checkbox" checked={isFull} onChange={(e) => setIsFull(e.target.checked)} className="h-5 w-5 accent-brand-600" />
      </label>

      <button
        type="button"
        onClick={() => setDetails((d) => !d)}
        aria-expanded={details}
        className="flex items-center justify-between rounded-xl px-1 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        Ayrıntılar (kilometre, tarih, not)
        <ChevronDown size={18} className={`transition ${details ? "rotate-180" : ""}`} />
      </button>
      {details ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Kilometre</span>
            <input type="text" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="125000" className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Tarih</span>
            <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="input" />
          </label>
          {!isFull ? (
            <label className="col-span-2 flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Dolumdan önce gösterge</span>
              <select value={gauge} onChange={(e) => setGauge(e.target.value)} className="input">
                <option value="">Bilmiyorum</option>
                {GAUGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Not</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shell, otoyol dönüşü…" className="input" />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-md shadow-brand-900/20 transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Kaydediliyor…" : total > 0 ? `${formatTL(total)} Kaydet` : "Kaydet"}
      </button>
    </div>
  );
}
