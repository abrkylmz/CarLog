import { useCallback, useEffect, useState } from "react";
import { Fuel, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import BackLink from "./components/BackLink";
import { useDialog } from "./components/DialogProvider";
import ExportDialog from "./components/ExportDialog";
import { nextReminderPreview, reminderTitle } from "./components/Reminders";
import { api, errorMessage, UNAUTHORIZED_EVENT, type AdminSetupState } from "./lib/api";
import { EXPENSE_CATEGORY_LABELS, formatDate, formatTL, parseAmount } from "./lib/format";
import { navigate, paths, useHashRoute, type Route } from "./lib/router";
import { AdminAuthPage, UserAuthPage } from "./pages/AuthPage";
import InvitePage, { InviteNotice } from "./pages/InvitePage";
import HomePage from "./pages/HomePage";
import NewVehiclePage from "./pages/NewVehiclePage";
import UsersPage from "./pages/UsersPage";
import VehiclePage from "./pages/VehiclePage";
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
} from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signed-out"; adminSetup: AdminSetupState }
  | { status: "ready"; user: User };

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const route = useHashRoute();

  const checkAuth = useCallback(() => {
    api
      .authStatus()
      .then(({ user, adminSetup }) => setAuth(user ? { status: "ready", user } : { status: "signed-out", adminSetup }))
      .catch((err) => setAuth({ status: "error", message: errorMessage(err) }));
  }, []);

  useEffect(checkAuth, [checkAuth]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, checkAuth);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, checkAuth);
  }, [checkAuth]);

  if (auth.status === "loading") return <CenteredMessage>Yükleniyor…</CenteredMessage>;
  if (auth.status === "error") {
    return (
      <CenteredMessage>
        <p className="text-red-600 dark:text-red-400">{auth.message}</p>
        <button type="button" onClick={checkAuth} className="mt-3 font-medium text-brand-600 hover:underline">
          Tekrar dene
        </button>
      </CenteredMessage>
    );
  }
  if (auth.status === "signed-out") {
    const onAuthenticated = (user: User) => setAuth({ status: "ready", user });
    return route.name === "admin" ? (
      <AdminAuthPage adminSetup={auth.adminSetup} onAuthenticated={onAuthenticated} />
    ) : (
      <UserAuthPage
        onAuthenticated={onAuthenticated}
        notice={route.name === "invite" ? <InviteNotice token={route.token} /> : undefined}
      />
    );
  }

  return (
    <SignedInApp
      user={auth.user}
      route={route}
      onLogout={async () => {
        await api.logout().catch(() => undefined);
        // Send each role back to the login panel it came from.
        navigate(auth.user.role === "admin" ? paths.admin : paths.home);
        checkAuth();
      }}
    />
  );
}

function SignedInApp({ user, route, onLogout }: { user: User; route: Route; onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  /** undefined = closed, "" = all vehicles, otherwise the pre-selected vehicle id. */
  const [exportFor, setExportFor] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isAdmin = user.role === "admin";
  const dialog = useDialog();
  const showError = (err: unknown) =>
    dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });

  const reload = useCallback(async () => {
    try {
      const [v, e, x, r] = await Promise.all([
        api.listVehicles(),
        api.listEntries(),
        api.listExpenses(),
        api.listReminders(),
      ]);
      // The catalog is optional: without it the vehicle form falls back to manual entry.
      api.listCatalog().then(setCatalog, () => undefined);
      setVehicles(v);
      setEntries(e);
      setExpenses(x);
      setReminders(r);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    // Pick up fill-ups other people added while this tab was in the background.
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  async function addVehicle(input: VehicleInput) {
    const vehicle = await api.createVehicle(input);
    setVehicles((prev) => [...(prev ?? []), vehicle]);
    navigate(paths.vehicle(vehicle.id, "dolumlar"));
  }

  async function updateVehicle(id: string, input: VehicleInput) {
    const vehicle = await api.updateVehicle(id, input);
    setVehicles((prev) => prev?.map((v) => (v.id === id ? vehicle : v)) ?? null);
  }

  async function deleteVehicle(id: string) {
    try {
      await api.deleteVehicle(id);
      setVehicles((prev) => prev?.filter((v) => v.id !== id) ?? null);
      setEntries((prev) => prev.filter((e) => e.vehicleId !== id));
      setExpenses((prev) => prev.filter((e) => e.vehicleId !== id));
      setReminders((prev) => prev.filter((r) => r.vehicleId !== id));
      navigate(paths.home);
    } catch (err) {
      await showError(err);
    }
  }

  async function addEntry(input: FuelEntryInput) {
    const entry = await api.createEntry(input);
    setEntries((prev) => [...prev, entry]);
  }

  async function deleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    const confirmed = await dialog.confirm({
      title: "Dolum kaydı silinsin mi?",
      message: entry
        ? `${formatDate(entry.date)} tarihli ${formatTL(entry.totalCost)} tutarındaki dolum kalıcı olarak silinecek.`
        : "Bu dolum kaydı kalıcı olarak silinecek.",
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!confirmed) return;
    try {
      await api.deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      await showError(err);
    }
  }

  // Per vehicle: the owner may edit or delete any record there, helpers only their own.
  const canEditIn = (vehicle: Vehicle) => (record: { createdById: string | null }) =>
    vehicle.myRole === "owner" || record.createdById === user.id;

  async function updateEntry(id: string, input: FuelEntryInput) {
    const entry = await api.updateEntry(id, input);
    setEntries((prev) => prev.map((e) => (e.id === id ? entry : e)));
  }

  async function updateExpense(id: string, input: ExpenseInput) {
    const expense = await api.updateExpense(id, input);
    setExpenses((prev) => prev.map((e) => (e.id === id ? expense : e)));
  }

  async function addReminder(input: ReminderInput) {
    const reminder = await api.createReminder(input);
    setReminders((prev) => [...prev, reminder]);
  }

  async function updateReminder(id: string, input: ReminderInput) {
    const reminder = await api.updateReminder(id, input);
    setReminders((prev) => prev.map((r) => (r.id === id ? reminder : r)));
  }

  async function completeReminder(reminder: Reminder, latestKm: number | null) {
    const next = nextReminderPreview(reminder, latestKm);
    const amountText = await dialog.prompt({
      title: `"${reminderTitle(reminder)}" tamamlandı mı?`,
      message: next
        ? `Bir sonraki hatırlatma otomatik kurulacak: ${next}.`
        : "Hatırlatma tamamlananlar listesine taşınacak.",
      tone: "success",
      confirmLabel: "Tamamlandı",
      input: {
        label: "Ödenen tutar (opsiyonel, masraf olarak eklenir)",
        inputMode: "decimal",
        placeholder: "Boş bırakabilirsiniz",
        validate: (value) => {
          if (!value.trim()) return null;
          const n = parseAmount(value);
          return Number.isFinite(n) && n > 0 ? null : "Geçerli bir tutar girin veya boş bırakın.";
        },
      },
    });
    if (amountText == null) return;
    const amount = amountText.trim() ? parseAmount(amountText) : undefined;
    try {
      const result = await api.completeReminder(reminder.id, amount);
      setReminders((prev) => [
        ...prev.map((r) => (r.id === reminder.id ? result.completed : r)),
        ...(result.next ? [result.next] : []),
      ]);
      if (result.expense) setExpenses((prev) => [...prev, result.expense!]);
    } catch (err) {
      await showError(err);
    }
  }

  async function deleteReminder(reminder: Reminder) {
    const confirmed = await dialog.confirm({
      title: "Hatırlatma silinsin mi?",
      message: `"${reminderTitle(reminder)}" hatırlatması kalıcı olarak silinecek.`,
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!confirmed) return;
    try {
      await api.deleteReminder(reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      await showError(err);
    }
  }

  async function addExpense(input: ExpenseInput) {
    const expense = await api.createExpense(input);
    setExpenses((prev) => [...prev, expense]);
  }

  async function deleteExpense(id: string) {
    const expense = expenses.find((e) => e.id === id);
    const confirmed = await dialog.confirm({
      title: "Masraf silinsin mi?",
      message: expense
        ? `${formatDate(expense.date)} tarihli ${formatTL(expense.amount)} tutarındaki "${EXPENSE_CATEGORY_LABELS[expense.category]}" masrafı kalıcı olarak silinecek.`
        : "Bu masraf kaydı kalıcı olarak silinecek.",
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!confirmed) return;
    try {
      await api.deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      await showError(err);
    }
  }

  let page: React.ReactNode;
  if (vehicles == null) {
    page = loadError ? (
      <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
    ) : (
      <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
    );
  } else if (route.name === "admin") {
    page = isAdmin ? <UsersPage currentUser={user} /> : <NotAllowed />;
  } else if (route.name === "invite") {
    page = (
      <InvitePage
        token={route.token}
        onAccepted={async (vehicleId) => {
          await reload();
          navigate(paths.vehicle(vehicleId));
        }}
      />
    );
  } else if (route.name === "new-vehicle") {
    page = <NewVehiclePage catalog={catalog} onCreate={addVehicle} />;
  } else if (route.name === "vehicle") {
    const vehicle = vehicles.find((v) => v.id === route.id);
    page = vehicle ? (
      <VehiclePage
        vehicle={vehicle}
        entries={entries.filter((e) => e.vehicleId === vehicle.id)}
        expenses={expenses.filter((e) => e.vehicleId === vehicle.id)}
        reminders={reminders.filter((r) => r.vehicleId === vehicle.id)}
        tab={route.tab}
        onAddEntry={addEntry}
        onUpdateEntry={updateEntry}
        onAddExpense={addExpense}
        onUpdateExpense={updateExpense}
        onAddReminder={addReminder}
        onUpdateReminder={updateReminder}
        onCompleteReminder={completeReminder}
        onUpdateVehicle={updateVehicle}
        onExport={() => setExportFor(vehicle.id)}
        currentUser={user}
        catalog={catalog}
        canEdit={canEditIn(vehicle)}
        onLeft={async () => {
          navigate(paths.home);
          await reload();
        }}
        onDeleteEntry={deleteEntry}
        onDeleteExpense={deleteExpense}
        onDeleteReminder={deleteReminder}
        onDeleteVehicle={vehicle.myRole === "owner" ? deleteVehicle : undefined}
      />
    ) : (
      <>
        <BackLink />
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Bu araç bulunamadı.
        </p>
      </>
    );
  } else {
    page = (
      <HomePage
        vehicles={vehicles}
        entries={entries}
        expenses={expenses}
        reminders={reminders}
        onReload={reload}
        onExport={() => setExportFor("")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <a href={paths.home} className="inline-flex items-center gap-2">
          <div className="rounded-lg bg-brand-600 p-2 text-white">
            <Fuel size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CarLog</h1>
          <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">Yakıt gideri takibi</span>
        </a>

        <div className="flex items-center gap-1 text-sm">
          <span
            className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            title={isAdmin ? "Yönetici" : "Kullanıcı"}
          >
            {isAdmin ? <ShieldCheck size={14} /> : <UserRound size={14} />}
            {user.username}
          </span>
          {isAdmin ? (
            <a
              href={paths.admin}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">Yönetici Paneli</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </header>

      {page}

      {exportFor !== undefined && vehicles ? (
        <ExportDialog
          vehicles={vehicles}
          entries={entries}
          expenses={expenses}
          reminders={reminders}
          defaultVehicleId={exportFor || undefined}
          onClose={() => setExportFor(undefined)}
        />
      ) : null}
    </div>
  );
}

function NotAllowed() {
  return (
    <>
      <BackLink />
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Bu sayfa için admin yetkisi gerekiyor.
      </p>
    </>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center text-sm text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}
