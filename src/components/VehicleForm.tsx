import { useMemo, useState } from "react";
import { Factory, Info, ListChecks, PencilLine } from "lucide-react";
import { errorMessage } from "../lib/api";
import { FUEL_TYPE_LABELS } from "../lib/format";
import type { CatalogEntry, FuelType, Vehicle, VehicleInput } from "../types";

interface Props {
  /** Vehicle catalog; empty while loading or unavailable, which leaves only manual entry. */
  catalog: CatalogEntry[];
  initial?: Vehicle;
  submitLabel: string;
  onSubmit: (vehicle: VehicleInput) => Promise<void>;
  onCancel?: () => void;
}

export function catalogVersionLabel(e: CatalogEntry): string {
  const years = `${e.yearFrom}–${e.yearTo ?? ""}`;
  const fuels = e.fuelTypes.map((f) => FUEL_TYPE_LABELS[f]).join("/");
  return `${e.generation} · ${years} · ${fuels} · ${e.tankCapacity} L`;
}

/**
 * Add or edit a vehicle. Picking brand → model → version from the catalog fills the fuel
 * options and the factory tank size; "Listede yok" falls back to typing everything in.
 */
export default function VehicleForm({ catalog, initial, submitLabel, onSubmit, onCancel }: Props) {
  const initialEntry = initial?.catalogId ? catalog.find((c) => c.id === initial.catalogId) : undefined;
  const [mode, setMode] = useState<"catalog" | "manual">(
    initialEntry || (!initial && catalog.length > 0) ? "catalog" : "manual",
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [fuelType, setFuelType] = useState<FuelType>(initial?.fuelType ?? "benzin");
  const [tankCapacity, setTankCapacity] = useState(initial?.tankCapacity ? String(initial.tankCapacity) : "");
  // Manual mode
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  // Catalog mode
  const [catBrand, setCatBrand] = useState(initialEntry?.brand ?? "");
  const [catModel, setCatModel] = useState(initialEntry?.model ?? "");
  const [entryId, setEntryId] = useState(initialEntry?.id ?? "");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const brands = useMemo(() => [...new Set(catalog.map((c) => c.brand))].sort((a, b) => a.localeCompare(b, "tr")), [catalog]);
  const models = useMemo(
    () => [...new Set(catalog.filter((c) => c.brand === catBrand).map((c) => c.model))].sort((a, b) => a.localeCompare(b, "tr")),
    [catalog, catBrand],
  );
  const versions = useMemo(
    () => catalog.filter((c) => c.brand === catBrand && c.model === catModel).sort((a, b) => a.yearFrom - b.yearFrom),
    [catalog, catBrand, catModel],
  );
  const entry = catalog.find((c) => c.id === entryId);

  function pickEntry(next: CatalogEntry | undefined) {
    setEntryId(next?.id ?? "");
    if (!next) return;
    setTankCapacity(String(next.tankCapacity));
    if (!next.fuelTypes.includes(fuelType)) setFuelType(next.fuelTypes[0]);
  }

  function pickBrand(value: string) {
    if (value === "__manual") return switchToManual();
    setCatBrand(value);
    setCatModel("");
    pickEntry(undefined);
  }

  function pickModel(value: string) {
    setCatModel(value);
    const options = catalog.filter((c) => c.brand === catBrand && c.model === value);
    // A model with a single version needs no further choice.
    pickEntry(options.length === 1 ? options[0] : undefined);
  }

  function switchToManual() {
    if (entry) {
      setBrand(entry.brand);
      setModel(entry.model);
    }
    setMode("manual");
  }

  const tankNumber = Number(tankCapacity.replace(",", "."));
  const tankEdited = entry && tankCapacity !== "" && tankNumber !== entry.tankCapacity;
  const yearNumber = Number(year);
  const yearOutsideRange =
    entry && year && Number.isInteger(yearNumber) && (yearNumber < entry.yearFrom || (entry.yearTo && yearNumber > entry.yearTo));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalBrand = mode === "catalog" ? entry?.brand ?? "" : brand.trim();
    const finalModel = mode === "catalog" ? entry?.model ?? "" : model.trim();
    if (mode === "catalog" && !entry) return setError("Marka, model ve versiyon seçin ya da \"Listede yok\" ile elle girin.");

    const trimmedName = name.trim() || [finalBrand, finalModel].filter(Boolean).join(" ");
    if (!trimmedName) return setError("Araca bir ad verin veya marka/model girin.");
    if (year && (!Number.isInteger(yearNumber) || yearNumber < 1900 || yearNumber > 2100)) {
      return setError("Geçerli bir model yılı girin.");
    }
    if (tankCapacity && !(tankNumber >= 5 && tankNumber <= 300)) {
      return setError("Depo hacmi 5-300 litre arasında olmalı.");
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        brand: finalBrand || undefined,
        model: finalModel || undefined,
        year: year ? yearNumber : undefined,
        plate: plate.trim().toLocaleUpperCase("tr-TR") || undefined,
        fuelType,
        tankCapacity: tankCapacity ? tankNumber : undefined,
        catalogId: mode === "catalog" ? entry?.id : undefined,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const fuelOptions: FuelType[] = mode === "catalog" && entry ? entry.fuelTypes : (Object.keys(FUEL_TYPE_LABELS) as FuelType[]);

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
    >
      {mode === "catalog" ? (
        <>
          <Field label="Marka">
            <select value={catBrand} onChange={(e) => pickBrand(e.target.value)} className="input" autoFocus={!initial}>
              <option value="">Seçin…</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="__manual">Listede yok — elle gireceğim</option>
            </select>
          </Field>

          <Field label="Model">
            <select value={catModel} onChange={(e) => pickModel(e.target.value)} className="input" disabled={!catBrand}>
              <option value="">{catBrand ? "Seçin…" : "Önce marka seçin"}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Versiyon (nesil · yıllar · yakıt · depo)">
              <select
                value={entryId}
                onChange={(e) => pickEntry(versions.find((v) => v.id === e.target.value))}
                className="input"
                disabled={!catModel}
              >
                <option value="">{catModel ? "Seçin…" : "Önce model seçin"}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {catalogVersionLabel(v)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
            Aracınız listede yoksa{" "}
            <button type="button" onClick={switchToManual} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
              elle girin
            </button>
            ; yöneticiye eksik model olarak bildirilir.
          </p>
        </>
      ) : (
        <>
          <Field label="Marka">
            <input type="text" placeholder="Toyota" value={brand} onChange={(e) => setBrand(e.target.value)} className="input" />
          </Field>
          <Field label="Model">
            <input type="text" placeholder="Corolla" value={model} onChange={(e) => setModel(e.target.value)} className="input" />
          </Field>
          {catalog.length > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
              <ListChecks size={14} />
              <span>
                Aracınız katalogda olabilir:{" "}
                <button
                  type="button"
                  onClick={() => setMode("catalog")}
                  className="font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  katalogdan seçin
                </button>
                , depo hacmi otomatik gelsin.
              </span>
            </p>
          ) : null}
        </>
      )}

      <Field label="Yakıt Türü">
        <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)} className="input">
          {fuelOptions.map((value) => (
            <option key={value} value={value}>
              {FUEL_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Model Yılı (opsiyonel)">
        <input
          type="number"
          inputMode="numeric"
          placeholder={entry ? String(entry.yearTo ?? new Date().getFullYear()) : "2019"}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="input"
        />
        {yearOutsideRange ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Bu versiyon {entry!.yearFrom}–{entry!.yearTo ?? ""} arası üretildi; doğru versiyonu seçtiğinizden emin olun.
          </span>
        ) : null}
      </Field>

      <Field label="Depo Hacmi (L)">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="50"
          value={tankCapacity}
          onChange={(e) => setTankCapacity(e.target.value)}
          className="input"
        />
        {entry ? (
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {tankEdited ? <PencilLine size={12} /> : <Factory size={12} />}
            {tankEdited ? `Değiştirildi (fabrika verisi ${entry.tankCapacity} L)` : `Fabrika verisi: ${entry.tankCapacity} L`}
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Opsiyonel; kısmi dolumlarda tüketim tahmini için kullanılır (ruhsat veya kullanım kılavuzunda yazar).
          </span>
        )}
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

      {entry?.note || entry?.lpgTankCapacity ? (
        <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 sm:col-span-2">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            {entry.note ? <p>{entry.note}</p> : null}
            {entry.lpgTankCapacity ? (
              <p>Fabrika LPG tankı: {entry.lpgTankCapacity} L. Tüketim hesabı şimdilik benzin deposuna göre yapılır.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <Field label="Araç Adı (opsiyonel)">
        <input
          type="text"
          placeholder={entry ? `${entry.brand} ${entry.model}` : "Aile arabası"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
      </Field>

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
