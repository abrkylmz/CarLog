import { useEffect, useMemo, useRef, useState } from "react";
import { Car, Download, Pencil, Trash2 } from "lucide-react";
import BackLink from "../components/BackLink";
import CategoryBreakdown from "../components/CategoryBreakdown";
import { useDialog } from "../components/DialogProvider";
import { errorMessage } from "../lib/api";
import EntryForm from "../components/EntryForm";
import EntryTable from "../components/EntryTable";
import ExpenseForm from "../components/ExpenseForm";
import ExpenseList from "../components/ExpenseList";
import Modal from "../components/Modal";
import MonthlySummaryTable from "../components/MonthlySummaryTable";
import { ReminderForm, ReminderList } from "../components/Reminders";
import SpendChart from "../components/SpendChart";
import SharePanel from "../components/SharePanel";
import StatCard from "../components/StatCard";
import UpcomingReminders from "../components/UpcomingReminders";
import VehicleForm, { catalogVersionLabel } from "../components/VehicleForm";
import { groupByMonth, vehicleStats, withDerived } from "../lib/calc";
import {
  CONSUMPTION_KIND_LABELS,
  formatConsumption,
  FUEL_TYPE_LABELS,
  formatDate,
  formatNumber,
  formatTL,
  vehicleSubtitle,
} from "../lib/format";
import { paths, VEHICLE_TAB_LABELS, VEHICLE_TABS, type VehicleTab } from "../lib/router";
import type {
  CatalogEntry,
  Expense,
  ExpenseInput,
  FuelEntry,
  FuelEntryInput,
  Reminder,
  ReminderInput,
  User,
  Vehicle,
  VehicleInput,
} from "../types";

/** Anything with an author; decides whether the edit button shows. */
type Authored = { createdById: string | null };

interface Props {
  vehicle: Vehicle;
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
  tab: VehicleTab;
  onAddEntry: (entry: FuelEntryInput) => Promise<void>;
  onUpdateEntry: (id: string, entry: FuelEntryInput) => Promise<void>;
  onAddExpense: (expense: ExpenseInput) => Promise<void>;
  onUpdateExpense: (id: string, expense: ExpenseInput) => Promise<void>;
  onAddReminder: (reminder: ReminderInput) => Promise<void>;
  onUpdateReminder: (id: string, reminder: ReminderInput) => Promise<void>;
  onCompleteReminder: (reminder: Reminder, latestKm: number | null) => void;
  onUpdateVehicle: (id: string, input: VehicleInput) => Promise<void>;
  onExport: () => void;
  currentUser: User;
  catalog: CatalogEntry[];
  /** The vehicle's owner may edit and delete every record, helpers only their own. */
  canEdit: (record: Authored) => boolean;
  /** Called after the current user leaves this shared vehicle. */
  onLeft: () => void;
  /** Record delete buttons follow canEdit; deleting the vehicle is passed to its owner only. */
  onDeleteEntry?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteReminder?: (reminder: Reminder) => void;
  onDeleteVehicle?: (id: string) => void;
}

export default function VehiclePage({
  vehicle,
  entries,
  expenses,
  reminders,
  tab,
  onAddEntry,
  onUpdateEntry,
  onAddExpense,
  onUpdateExpense,
  onAddReminder,
  onUpdateReminder,
  onCompleteReminder,
  onExport,
  currentUser,
  catalog,
  canEdit,
  onLeft,
  onDeleteEntry,
  onDeleteExpense,
  onDeleteReminder,
  onUpdateVehicle,
  onDeleteVehicle,
}: Props) {
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const tabsRef = useRef<HTMLElement>(null);

  // On narrow screens the active tab can sit off-screen (e.g. opened via a card shortcut);
  // scroll only the strip, never the page.
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector<HTMLElement>("[data-active]");
    if (!nav || !active) return;
    const left = active.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = left - 16;
    }
  }, [tab]);
  const tank = vehicle.tankCapacity;
  const derived = useMemo(() => withDerived(entries, tank), [entries, tank]);
  const summaries = useMemo(() => groupByMonth(entries, expenses, tank), [entries, expenses, tank]);
  const stats = useMemo(() => vehicleStats(entries, expenses, tank), [entries, expenses, tank]);
  const thisMonthTotal = stats.thisMonthCost + stats.thisMonthOtherCost;
  const grandTotal = stats.totalCost + stats.otherCostTotal;
  const split = (fuel: number, other: number) => `Yakıt ${formatTL(fuel)} · Diğer ${formatTL(other)}`;
  const subtitle = vehicleSubtitle(vehicle);
  const latestKm = stats.latestOdometerKm;

  return (
    <>
      <BackLink />

      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Car size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{vehicle.name}</h2>
            {vehicle.plate ? (
              <span className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                {vehicle.plate}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[subtitle, FUEL_TYPE_LABELS[vehicle.fuelType]].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Dışa Aktar</span>
        </button>
      </div>

      {/* Horizontal-only tab strip. The outer box draws the baseline (an inset shadow, so the active
          tab's underline covers it) and clips the scroller's extra bottom padding: iOS Safari draws its
          own scroll indicator there and ignores the CSS that hides scrollbars elsewhere. */}
      <div className="mb-6 overflow-hidden shadow-[inset_0_-1px_0_theme(colors.slate.200)] dark:shadow-[inset_0_-1px_0_theme(colors.slate.800)]">
        <nav
          ref={tabsRef}
          className="-mb-5 flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {VEHICLE_TABS.map((t) => (
            <a
              key={t}
              href={paths.vehicle(vehicle.id, t)}
              data-active={t === tab || undefined}
              aria-current={t === tab ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                t === tab
                  ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {VEHICLE_TAB_LABELS[t]}
            </a>
          ))}
        </nav>
      </div>

      {tab === "ozet" && (
        <>
          <UpcomingReminders
            reminders={reminders}
            vehicles={[vehicle]}
            latestKmByVehicle={new Map([[vehicle.id, latestKm]])}
            showVehicle={false}
          />
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Bu Ay Toplam"
              value={formatTL(thisMonthTotal)}
              hint={split(stats.thisMonthCost, stats.thisMonthOtherCost)}
            />
            <StatCard label="Genel Toplam" value={formatTL(grandTotal)} hint={split(stats.totalCost, stats.otherCostTotal)} />
            <StatCard
              label="Ort. Tüketim"
              value={
                stats.avgConsumptionPer100km != null
                  ? `${formatConsumption(stats.avgConsumptionPer100km, stats.consumptionKind)} L/100km`
                  : "—"
              }
              hint={
                stats.kmTracked > 0 && stats.consumptionKind
                  ? `${formatNumber(stats.kmTracked, 0)} km · ${CONSUMPTION_KIND_LABELS[stats.consumptionKind]}`
                  : undefined
              }
            />
            <StatCard
              label="Ortalama TL/L"
              value={stats.avgPricePerLiter > 0 ? formatNumber(stats.avgPricePerLiter, 2) : "—"}
              hint={`${formatNumber(stats.totalLiters)} L toplam`}
            />
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Son Kilometre"
              value={stats.latestOdometerKm != null ? `${formatNumber(stats.latestOdometerKm, 0)} km` : "—"}
            />
            <StatCard
              label="Son Dolum"
              value={stats.lastFillDate ? formatDate(stats.lastFillDate) : "—"}
            />
            <StatCard
              label="Diğer Masraflar"
              value={formatTL(stats.otherCostTotal)}
              hint={stats.expenseCount > 0 ? `${stats.expenseCount} kayıt` : "Henüz masraf yok"}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Aylık Harcama</h3>
            <SpendChart summaries={summaries} />
          </section>
        </>
      )}

      {tab === "dolumlar" && (
        <>
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Dolum Ekle</h3>
            <EntryForm vehicleId={vehicle.id} onAdd={onAddEntry} tankCapacity={tank} otherEntries={entries} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Kayıtlar</h3>
            <FillUpStatusNotice
              entries={entries}
              stats={stats}
              canEdit={canEdit}
              onUpdateEntry={onUpdateEntry}
              hasTank={Boolean(tank)}
            />
            <EntryTable entries={derived} onDelete={onDeleteEntry} onEdit={setEditingEntry} canEdit={canEdit} />
            <ConsumptionExplainer />
          </section>
        </>
      )}

      {tab === "masraflar" && (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Bu Ay Masraf" value={formatTL(stats.thisMonthOtherCost)} hint="Yakıt hariç" />
            <StatCard
              label="Bu Ay Toplam"
              value={formatTL(thisMonthTotal)}
              hint={split(stats.thisMonthCost, stats.thisMonthOtherCost)}
            />
            <StatCard
              label="Toplam Masraf"
              value={formatTL(stats.otherCostTotal)}
              hint={`${stats.expenseCount} kayıt · yakıt hariç`}
            />
            <StatCard label="Genel Toplam" value={formatTL(grandTotal)} hint="Yakıt + diğer masraflar" />
          </section>

          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Masraf Ekle</h3>
            <ExpenseForm vehicleId={vehicle.id} onAdd={onAddExpense} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Masraflar</h3>
              <ExpenseList
                expenses={expenses}
                onDelete={onDeleteExpense}
                onEdit={setEditingExpense}
                canEdit={canEdit}
              />
            </section>
            {expenses.length > 0 ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Türlere Göre</h3>
                <CategoryBreakdown expenses={expenses} />
              </section>
            ) : null}
          </div>
        </>
      )}

      {tab === "hatirlatmalar" && (
        <>
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Yeni Hatırlatma</h3>
            <ReminderForm vehicleId={vehicle.id} latestKm={latestKm} onSubmit={onAddReminder} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Hatırlatmalar</h3>
            <ReminderList
              reminders={reminders}
              latestKm={latestKm}
              onComplete={(r) => onCompleteReminder(r, latestKm)}
              onEdit={setEditingReminder}
              canEdit={canEdit}
              onDelete={onDeleteReminder}
            />
          </section>
        </>
      )}

      {tab === "aylik" && (
        <section>
          <div className="mb-4">
            <SpendChart summaries={summaries} />
          </div>
          <MonthlySummaryTable summaries={summaries} />
        </section>
      )}

      {tab === "paylasim" && <SharePanel vehicle={vehicle} currentUser={currentUser} onLeft={onLeft} />}

      {tab === "bilgiler" && (
        <VehicleSettings
          vehicle={vehicle}
          catalog={catalog}
          recordCount={entries.length + expenses.length + reminders.length}
          onUpdate={onUpdateVehicle}
          onDelete={onDeleteVehicle}
        />
      )}

      {editingEntry ? (
        <Modal title="Dolumu Düzenle" onClose={() => setEditingEntry(null)} width="max-w-2xl">
          <EntryForm
            vehicleId={vehicle.id}
            tankCapacity={tank}
            otherEntries={entries}
            initial={editingEntry}
            submitLabel="Kaydet"
            onCancel={() => setEditingEntry(null)}
            onAdd={async (input) => {
              await onUpdateEntry(editingEntry.id, input);
              setEditingEntry(null);
            }}
          />
        </Modal>
      ) : null}

      {editingExpense ? (
        <Modal title="Masrafı Düzenle" onClose={() => setEditingExpense(null)} width="max-w-2xl">
          <ExpenseForm
            vehicleId={vehicle.id}
            initial={editingExpense}
            submitLabel="Kaydet"
            onCancel={() => setEditingExpense(null)}
            onAdd={async (input) => {
              await onUpdateExpense(editingExpense.id, input);
              setEditingExpense(null);
            }}
          />
        </Modal>
      ) : null}

      {editingReminder ? (
        <Modal title="Hatırlatmayı Düzenle" onClose={() => setEditingReminder(null)} width="max-w-2xl">
          <ReminderForm
            vehicleId={vehicle.id}
            latestKm={latestKm}
            initial={editingReminder}
            submitLabel="Kaydet"
            onCancel={() => setEditingReminder(null)}
            onSubmit={async (input) => {
              await onUpdateReminder(editingReminder.id, input);
              setEditingReminder(null);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

/**
 * Fill-ups from before "Depo fullendi" existed have no full/partial status, which forces the
 * rough estimate. Offers to mark the ones this user may edit as full in one go.
 */
function FillUpStatusNotice({
  entries,
  stats,
  canEdit,
  onUpdateEntry,
  hasTank,
}: {
  entries: FuelEntry[];
  stats: ReturnType<typeof vehicleStats>;
  canEdit: (record: Authored) => boolean;
  onUpdateEntry: (id: string, entry: FuelEntryInput) => Promise<void>;
  hasTank: boolean;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const unknown = entries.filter((e) => e.isFull == null);
  const editable = unknown.filter(canEdit);
  const notes: React.ReactNode[] = [];

  async function markAllFull() {
    const confirmed = await dialog.confirm({
      title: `${editable.length} dolum "full" olarak işaretlensin mi?`,
      message:
        "Bu dolumlarda depoyu fullediyseniz tüketim kesin hesaplanır. Yarım aldığınız dolumlar varsa onları sonradan tek tek düzenleyip \"kısmi\" yapabilirsiniz.",
      confirmLabel: "Full Olarak İşaretle",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      for (const e of editable) {
        await onUpdateEntry(e.id, {
          vehicleId: e.vehicleId,
          date: e.date,
          odometerKm: e.odometerKm,
          liters: e.liters,
          pricePerLiter: e.pricePerLiter,
          totalCost: e.totalCost,
          isFull: true,
          note: e.note,
        });
      }
    } catch (err) {
      await dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (unknown.length > 0) {
    notes.push(
      <div key="unknown" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <b>{unknown.length}</b> eski dolumda depo durumu (full/kısmi) girilmemiş, bu yüzden tüketim bu dolumlar için
          kaba tahmin.
        </span>
        {editable.length > 0 ? (
          <button
            type="button"
            onClick={markAllFull}
            disabled={busy}
            className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            {busy ? "İşaretleniyor…" : `${editable.length === unknown.length ? "Hepsini" : `Benim ${editable.length} dolumumu`} full olarak işaretle`}
          </button>
        ) : null}
      </div>,
    );
  }
  if (stats.suspiciousCount > 0) {
    notes.push(
      <p key="suspicious">
        <b>{stats.suspiciousCount}</b> aralıkta olağandışı tüketim var (⚠ işaretli); ortalamalara katılmadı. Genelde
        girilmemiş bir dolum veya yanlış kilometreden kaynaklanır.
      </p>,
    );
  }
  if (!hasTank && entries.some((e) => e.isFull === false)) {
    notes.push(
      <p key="tank">
        Kısmi dolumları gösterge ile tahmin edebilmek için <b>Araç Bilgileri</b>'nden depo hacmini girin.
      </p>,
    );
  }
  if (notes.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      {notes}
    </div>
  );
}

function ConsumptionExplainer() {
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer px-4 py-2.5 font-medium text-slate-600 dark:text-slate-300">
        Tüketim nasıl hesaplanır?
      </summary>
      <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <p>
          <b>Kesin (full–full):</b> İki full dolum arasında alınan tüm yakıt (aradaki yarım dolumlar dahil) o aradaki
          kilometreye bölünür. En doğru yöntem budur; ara ara depoyu fullemeniz yeterli.
        </p>
        <p>
          <b>~ Göstergeye göre tahmini:</b> Kısmi dolumlarda, dolumdan önceki gösterge ve aracın depo hacmiyle dolumdan
          doluma hesaplanır. Göstergeler tam hassas olmadığından yaklaşıktır.
        </p>
        <p>
          <b>~ Kaba tahmin:</b> İkisi de yoksa toplam litre toplam kilometreye bölünür. Depodaki yakıt bilinmediği için bir
          depo kadar sapabilir; uzun mesafede güvenilir hale gelir.
        </p>
        <p>
          2–30 L/100km dışındaki değerler ⚠ ile işaretlenir ve ortalamalara katılmaz. Aylık raporda bir aralık, onu
          kapatan dolumun ayına sayılır.
        </p>
      </div>
    </details>
  );
}

function VehicleSettings({
  vehicle,
  catalog,
  recordCount,
  onUpdate,
  onDelete,
}: {
  vehicle: Vehicle;
  catalog: CatalogEntry[];
  recordCount: number;
  onUpdate: (id: string, input: VehicleInput) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  const [saved, setSaved] = useState(false);
  const dialog = useDialog();

  async function handleDelete() {
    const confirmed = await dialog.confirm({
      title: `"${vehicle.name}" silinsin mi?`,
      message:
        recordCount > 0
          ? `Araç ve ona ait ${recordCount} dolum/masraf/hatırlatma kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.`
          : "Araç kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      tone: "danger",
      confirmLabel: "Aracı Sil",
    });
    if (confirmed) onDelete?.(vehicle.id);
  }

  const catalogEntry = vehicle.catalogId ? catalog.find((c) => c.id === vehicle.catalogId) : undefined;

  if (vehicle.myRole !== "owner") {
    const rows: [string, string | undefined][] = [
      ["Araç Adı", vehicle.name],
      ["Plaka", vehicle.plate],
      ["Marka", vehicle.brand],
      ["Model", vehicle.model],
      ["Model Yılı", vehicle.year ? String(vehicle.year) : undefined],
      ["Yakıt Türü", FUEL_TYPE_LABELS[vehicle.fuelType]],
      ["Katalog Versiyonu", catalogEntry ? catalogVersionLabel(catalogEntry) : "Elle girildi"],
      ["Depo Hacmi", vehicle.tankCapacity ? `${vehicle.tankCapacity} L` : undefined],
      ["Sahibi", vehicle.ownerName ?? undefined],
    ];
    return (
      <section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="font-medium">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Araç bilgilerini yalnızca aracın sahibi değiştirebilir.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Pencil size={14} />
          Bilgileri Düzenle
          {saved ? <span className="ml-2 font-normal text-emerald-600 dark:text-emerald-400">Kaydedildi</span> : null}
        </h3>
        <VehicleForm
          key={`${vehicle.id}-${catalog.length}`}
          catalog={catalog}
          initial={vehicle}
          submitLabel="Kaydet"
          onSubmit={async (input) => {
            setSaved(false);
            await onUpdate(vehicle.id, input);
            setSaved(true);
          }}
        />
      </section>

      {onDelete ? (
        <section className="rounded-xl border border-red-200 p-4 dark:border-red-900/60">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Aracı Sil</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Araç ve tüm dolum/masraf kayıtları kalıcı olarak silinir.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 size={14} />
            Aracı Sil
          </button>
        </section>
      ) : null}
    </>
  );
}
