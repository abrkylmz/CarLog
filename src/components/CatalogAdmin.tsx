import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { FUEL_TYPE_LABELS } from "../lib/format";
import type { CatalogEntry, CatalogEntryInput, FactoryConsumption, FuelType, MissingCatalogModel, TestCycle } from "../types";
import { useDialog } from "./DialogProvider";
import { toast } from "./Toaster";
import { CancelButton } from "./EntryForm";
import Modal from "./Modal";
import ScrollX from "./ScrollX";

/** Admin view of the vehicle catalog, plus hand-entered models that are missing from it. */
export default function CatalogAdmin({ onMissingChange }: { onMissingChange?: (count: number) => void }) {
  const dialog = useDialog();
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [missing, setMissing] = useState<MissingCatalogModel[]>([]);
  const [query, setQuery] = useState("");
  /** fromMissing: opened from the "missing" list, so the form offers to link those vehicles. */
  const [editing, setEditing] = useState<{
    entry?: CatalogEntry;
    draft?: Partial<CatalogEntryInput>;
    fromMissing?: MissingCatalogModel;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listCatalog(), api.catalogMissing()])
      .then(([c, m]) => {
        setEntries(c);
        setMissing(m);
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (entries) onMissingChange?.(missing.length);
  }, [entries, missing, onMissingChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const list = entries ?? [];
    return q ? list.filter((e) => `${e.brand} ${e.model} ${e.generation}`.toLocaleLowerCase("tr-TR").includes(q)) : list;
  }, [entries, query]);

  async function remove(entry: CatalogEntry) {
    const confirmed = await dialog.confirm({
      title: `${entry.brand} ${entry.model} ${entry.generation} silinsin mi?`,
      message: "Bu versiyonu seçmiş araçların bilgileri korunur; yalnızca \"elle girilmiş\" sayılırlar.",
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!confirmed) return;
    try {
      await api.deleteCatalogEntry(entry.id);
      setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
    } catch (err) {
      await dialog.alert({ title: "Silinemedi", message: errorMessage(err), tone: "danger" });
    }
  }

  async function save(input: CatalogEntryInput, linkVehicles: boolean) {
    if (editing?.entry) {
      const updated = await api.updateCatalogEntry(editing.entry.id, input);
      setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
      toast("Katalog kaydı güncellendi");
    } else {
      const { linked, ...created } = await api.createCatalogEntry(input, linkVehicles);
      setEntries((prev) => [...(prev ?? []), created]);
      // The server knows which vehicles were linked (years and fuel types decide), so ask it again.
      setMissing(await api.catalogMissing().catch(() => missing));
      toast(linked ? `Kataloğa eklendi · ${linked} araç bağlandı` : "Kataloğa eklendi");
    }
    setEditing(null);
  }

  if (loadError) return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  if (!entries) return <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>;

  return (
    <>
      {missing.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-300">Katalogda Olmayan Araçlar</h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Kullanıcıların "listede yok" diyerek elle girdiği modeller. Kimin aracı olduğu gösterilmez.
          </p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {missing.map((m) => (
              <li key={`${m.brand}-${m.model}-${m.year}-${m.fuelType}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <b>
                    {m.brand} {m.model}
                  </b>
                  <span className="text-slate-500 dark:text-slate-400">
                    {m.year ? ` · ${m.year}` : ""} · {FUEL_TYPE_LABELS[m.fuelType]} · {m.count} araç
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      draft: { brand: m.brand, model: m.model, yearFrom: m.year, fuelTypes: [m.fuelType] },
                      fromMissing: m,
                    })
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30"
                >
                  <Plus size={14} />
                  Kataloğa ekle
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Araç Kataloğu <span className="font-normal text-slate-400">({entries.length} versiyon)</span>
          </h3>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Ara: corolla, bmw…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input w-48 !pl-8"
              />
            </label>
            <button
              type="button"
              onClick={() => setEditing({})}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              <Plus size={16} />
              Ekle
            </button>
          </div>
        </div>

        <ScrollX className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <th className="px-3 py-2 font-medium">Marka</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Nesil</th>
                <th className="px-3 py-2 font-medium">Yıllar</th>
                <th className="px-3 py-2 font-medium">Yakıt</th>
                <th className="px-3 py-2 font-medium">Depo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-3 py-2 whitespace-nowrap">{e.brand}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{e.model}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.generation}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.yearFrom}–{e.yearTo ?? ""}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {e.fuelTypes.map((f) => FUEL_TYPE_LABELS[f]).join(", ")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" title={e.note}>
                    {e.tankCapacity} L{e.lpgTankCapacity ? ` + ${e.lpgTankCapacity} L LPG` : ""}
                    {e.note ? <span className="ml-1 text-amber-600">*</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing({ entry: e })}
                      aria-label={`${e.model} ${e.generation} düzenle`}
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      aria-label={`${e.model} ${e.generation} sil`}
                      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">* Notlu kayıtlar (ör. opsiyonel büyük depo); üzerine gelince görünür.</p>
      </section>

      {editing ? (
        <Modal title={editing.entry ? "Katalog Kaydını Düzenle" : "Kataloğa Ekle"} onClose={() => setEditing(null)} width="max-w-2xl">
          <CatalogForm
            initial={editing.entry ?? editing.draft}
            fromMissing={editing.fromMissing}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        </Modal>
      ) : null}
    </>
  );
}

function CatalogForm({
  initial,
  fromMissing,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<CatalogEntryInput>;
  fromMissing?: MissingCatalogModel;
  onSubmit: (input: CatalogEntryInput, linkVehicles: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [link, setLink] = useState(true);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [generation, setGeneration] = useState(initial?.generation ?? "");
  const [yearFrom, setYearFrom] = useState(initial?.yearFrom ? String(initial.yearFrom) : "");
  const [yearTo, setYearTo] = useState(initial?.yearTo ? String(initial.yearTo) : "");
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>(initial?.fuelTypes ?? ["benzin"]);
  const [tank, setTank] = useState(initial?.tankCapacity ? String(initial.tankCapacity) : "");
  const [lpgTank, setLpgTank] = useState(initial?.lpgTankCapacity ? String(initial.lpgTankCapacity) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  // Factory consumption, one optional row per selected fuel type (blank L/100km = none).
  const [factory, setFactory] = useState<Record<string, { engine: string; value: string; cycle: TestCycle }>>(() =>
    Object.fromEntries(
      (initial?.factoryConsumption ?? []).map((f) => [f.fuelType, { engine: f.engine, value: String(f.lPer100km), cycle: f.cycle }]),
    ),
  );
  const factoryRow = (f: FuelType) => factory[f] ?? { engine: "", value: "", cycle: "WLTP" as TestCycle };
  const setFactoryRow = (f: FuelType, patch: Partial<{ engine: string; value: string; cycle: TestCycle }>) =>
    setFactory((prev) => ({ ...prev, [f]: { ...factoryRow(f), ...patch } }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const num = (v: string) => Number(v.replace(",", "."));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        brand: brand.trim(),
        model: model.trim(),
        generation: generation.trim(),
        yearFrom: num(yearFrom),
        yearTo: yearTo ? num(yearTo) : undefined,
        fuelTypes,
        tankCapacity: num(tank),
        lpgTankCapacity: lpgTank ? num(lpgTank) : undefined,
        note: note.trim() || undefined,
        factoryConsumption: fuelTypes
          .map((f): FactoryConsumption | null => {
            const row = factoryRow(f);
            return row.value.trim() ? { fuelType: f, engine: row.engine.trim(), lPer100km: num(row.value), cycle: row.cycle } : null;
          })
          .filter((f): f is FactoryConsumption => f != null),
      }, Boolean(fromMissing) && link);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
      <Field label="Marka">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input" required />
      </Field>
      <Field label="Model">
        <input value={model} onChange={(e) => setModel(e.target.value)} className="input" required />
      </Field>
      <Field label="Nesil / Versiyon">
        <input value={generation} onChange={(e) => setGeneration(e.target.value)} placeholder="E210 Hibrit" className="input" required />
      </Field>
      <Field label="Başlangıç Yılı">
        <input type="number" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} className="input" required />
      </Field>
      <Field label="Bitiş Yılı (üretimde ise boş)">
        <input type="number" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value)} className="input" />
      </Field>
      <Field label="Depo (L)">
        <input type="number" inputMode="decimal" step="any" value={tank} onChange={(e) => setTank(e.target.value)} className="input" required />
      </Field>
      <fieldset className="col-span-full flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <legend className="mb-1 font-medium text-slate-600 dark:text-slate-300">Yakıt tipleri</legend>
        {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map((f) => (
          <label key={f} className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={fuelTypes.includes(f)}
              onChange={(e) => setFuelTypes((prev) => (e.target.checked ? [...prev, f] : prev.filter((x) => x !== f)))}
              className="h-4 w-4 accent-brand-600"
            />
            {FUEL_TYPE_LABELS[f]}
          </label>
        ))}
      </fieldset>
      <Field label="Fabrika LPG Tankı (L, opsiyonel)">
        <input type="number" inputMode="decimal" step="any" value={lpgTank} onChange={(e) => setLpgTank(e.target.value)} className="input" />
      </Field>
      <div className="col-span-2">
        <Field label="Not (opsiyonel, formda kullanıcıya gösterilir)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsiyonel 66 L depo ile de satıldı." className="input" />
        </Field>
      </div>
      <fieldset className="col-span-full flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium text-slate-600 dark:text-slate-300">
          Fabrika tüketimi <span className="font-normal text-slate-400">(opsiyonel, karma L/100km)</span>
        </legend>
        {fuelTypes.map((f) => {
          const row = factoryRow(f);
          return (
            <div key={f} className="grid grid-cols-[6rem_1fr_5.5rem_6rem] items-center gap-2 max-sm:grid-cols-2">
              <span className="font-medium text-slate-600 dark:text-slate-300">{FUEL_TYPE_LABELS[f]}</span>
              <input
                value={row.engine}
                onChange={(e) => setFactoryRow(f, { engine: e.target.value })}
                placeholder="Motor, ör. 1.0 TCe 90 HP"
                aria-label={`${FUEL_TYPE_LABELS[f]} motoru`}
                className="input"
              />
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={row.value}
                onChange={(e) => setFactoryRow(f, { value: e.target.value })}
                placeholder="L/100km"
                aria-label={`${FUEL_TYPE_LABELS[f]} fabrika tüketimi`}
                className="input"
              />
              <select
                value={row.cycle}
                onChange={(e) => setFactoryRow(f, { cycle: e.target.value as TestCycle })}
                aria-label="Ölçüm türü"
                className="input"
              >
                <option value="WLTP">WLTP</option>
                <option value="NEDC">NEDC</option>
              </select>
            </div>
          );
        })}
      </fieldset>
      {fromMissing ? (
        <label className="col-span-full flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm dark:bg-brand-900/30">
          <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>
            <b>Elle girilmiş araçları bu kayda bağla.</b>{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Markası ve modeli aynı, yılı ve yakıt tipi bu kayda uyan araçlar katalogdan seçilmiş sayılır ve bu listeden
              çıkar. Sahiplerinin girdiği bilgiler (depo hacmi, plaka…) değişmez.
            </span>
          </span>
        </label>
      ) : null}
      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
        <div className="flex gap-2">
          <CancelButton onClick={onCancel} />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Kaydediliyor…" : "Kaydet"}
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
