import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fuel, Search, X } from "lucide-react";
import PasswordDialog from "./components/PasswordDialog";
import AppSidebar from "./components/AppSidebar";
import AppBottomNav from "./components/AppBottomNav";
import { ReminderBell, SearchBox, UserMenu, YearSelect } from "./components/TopBar";
import { dataYears } from "./lib/dashboard";
import BackLink from "./components/BackLink";
import { useDialog } from "./components/DialogProvider";

import LoadingSkeleton from "./components/LoadingSkeleton";

import { wrappedYear, yearSummary } from "./lib/wrapped";
import Toaster, { toast } from "./components/Toaster";
import QuickAdd from "./components/QuickAdd";
import ThemeToggle from "./components/ThemeToggle";
import { nextReminderPreview, reminderTitle } from "./components/Reminders";
import { api, ApiError, errorMessage, UNAUTHORIZED_EVENT, type AdminSetupState } from "./lib/api";
import { EXPENSE_CATEGORY_LABELS, formatDate, formatTL, parseAmount } from "./lib/format";
import { navigate, paths, useHashRoute, type Route } from "./lib/router";
import { FUEL_ACCENT, usePageAccent } from "./lib/theme";
import { animateOut, clearLeaving } from "./lib/motion";
import { dropFromOutbox, enqueue, enqueueChange, isOfflineError, LOCAL_ID_PREFIX, readOutbox, replaceInOutbox, type OutboxKind } from "./lib/outbox";
import OnlineStatus from "./components/OnlineStatus";
import PullToRefresh from "./components/PullToRefresh";

const OFFLINE_SAVED = "Çevrimdışı kaydedildi";
import { AdminAuthPage, UserAuthPage } from "./pages/AuthPage";
import InvitePage, { InviteNotice } from "./pages/InvitePage";
import HomePage from "./pages/HomePage";
import { planById, vehicleLimit } from "./lib/plans";
import { SessionContext } from "./lib/session";
import type { Services } from "./lib/api";

// Pages and dialogs that aren't needed for the first screen load on demand, so the home screen
// (and the login screen) open faster, especially on phones.
const VehiclePage = lazy(() => import("./pages/VehiclePage"));
const NewVehiclePage = lazy(() => import("./pages/NewVehiclePage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const WrappedStories = lazy(() => import("./components/WrappedStories"));
const ExportDialog = lazy(() => import("./components/ExportDialog"));
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
  const [services, setServices] = useState<Services>({ receiptScan: false, mail: false });
  const route = useHashRoute();

  const checkAuth = useCallback(() => {
    api
      .authStatus()
      .then(({ user, adminSetup, services }) => {
        if (services) setServices(services);
        setAuth(user ? { status: "ready", user } : { status: "signed-out", adminSetup });
      })
      .catch((err) => setAuth({ status: "error", message: errorMessage(err) }));
  }, []);

  useEffect(checkAuth, [checkAuth]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, checkAuth);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, checkAuth);
  }, [checkAuth]);

  // The privacy notice and password reset links open whether or not anyone is signed in.
  if (route.name === "privacy" || route.name === "reset") {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        {route.name === "privacy" ? <PrivacyPage /> : <ResetPasswordPage token={route.token} />}
      </Suspense>
    );
  }

  if (auth.status === "loading") {
    // Session check: show the page's outline instead of a bare "loading" text.
    return (
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="skeleton h-9 w-9 !rounded-xl" />
          <div className="skeleton h-5 w-24" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }
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
    <SessionContext.Provider value={{ user: auth.user, services }}>
    <SignedInApp
      user={auth.user}
      route={route}
      onUserChange={(user) => setAuth({ status: "ready", user })}
      onLogout={async () => {
        await api.logout().catch(() => undefined);
        // Forget this account's saved data in the offline cache.
        navigator.serviceWorker?.controller?.postMessage({ type: "clear-data" });
        // Send each role back to the login panel it came from.
        navigate(auth.user.role === "admin" ? paths.admin : paths.home);
        checkAuth();
      }}
    />
    </SessionContext.Provider>
  );
}

function SignedInApp({
  user,
  route,
  onLogout,
  onUserChange,
}: {
  user: User;
  route: Route;
  onLogout: () => void;
  /** After the user's own account changes (e.g. a new plan). */
  onUserChange: (user: User) => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  /** undefined = closed, "" = all vehicles, otherwise the pre-selected vehicle id. */
  const [exportFor, setExportFor] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState(false);
  const isAdmin = user.role === "admin";
  const dialog = useDialog();
  const showError = (err: unknown) =>
    dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });

  // A record added offline, shown in the lists until the server gives it a real id.
  const placeholder = useCallback(
    <T,>(input: unknown, id: string) =>
      ({ ...(input as object), id, createdBy: user.username, createdById: user.id, createdAt: new Date().toISOString() }) as T,
    [user.id, user.username],
  );

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
      // Keep records that are still waiting to be sent.
      const pending = readOutbox(user.id);
      const waiting = <T,>(kind: string) =>
        pending
          .filter((item) => item.kind === kind && (item.op ?? "create") === "create")
          .map((item) => placeholder<T>(item.input, item.localId));
      // Edits and deletes made offline still show until they're sent.
      const withChanges = <T extends { id: string },>(kind: OutboxKind, list: T[]) => {
        const changes = new Map(pending.filter((i) => i.kind === kind && i.targetId).map((i) => [i.targetId!, i]));
        return list
          .filter((rec) => changes.get(rec.id)?.op !== "delete")
          .map((rec) => {
            const change = changes.get(rec.id);
            return change?.op === "update" ? ({ ...rec, ...(change.input as object), id: rec.id } as T) : rec;
          });
      };
      setVehicles(v);
      setEntries([...withChanges("entry", e), ...waiting<FuelEntry>("entry")]);
      setExpenses([...withChanges("expense", x), ...waiting<Expense>("expense")]);
      setReminders([...withChanges("reminder", r), ...waiting<Reminder>("reminder")]);
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
    let vehicle: Vehicle;
    try {
      vehicle = await api.createVehicle(input);
    } catch (err) {
      // Over the plan's vehicle limit: show the plans instead of an error.
      if (err instanceof ApiError && err.code === "plan_limit") {
        navigate(paths.plans);
        toast("Daha fazla araç için paketinizi yükseltin");
        return;
      }
      throw err;
    }
    setVehicles((prev) => [...(prev ?? []), vehicle]);
    navigate(paths.vehicle(vehicle.id, "dolumlar"));
  }

  async function updateVehicle(id: string, input: VehicleInput) {
    const vehicle = await api.updateVehicle(id, input);
    setVehicles((prev) => prev?.map((v) => (v.id === id ? vehicle : v)) ?? null);
    toast("Araç bilgileri kaydedildi");
  }

  /** Set, change or clear the monthly spending target shown as the home screen's ring. */
  /**
   * Deletes the user's own account after the password; if they own vehicles, says what happens to
   * them (handed to a helper or deleted) and asks once more.
   */
  /** Adds, changes or removes the email used for password resets (asks for the password). */
  async function editEmail() {
    const email = await dialog.prompt({
      title: "E-posta adresiniz",
      message: "Yalnızca şifrenizi unutursanız sıfırlama bağlantısı göndermek için kullanılır. Kaldırmak için boş bırakın.",
      confirmLabel: "Devam",
      input: {
        label: "E-posta",
        placeholder: user.email ?? "ornek@eposta.com",
        validate: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : "Geçerli bir e-posta adresi girin."),
      },
    });
    if (email == null) return;
    const password = await dialog.prompt({
      title: "Şifrenizi onaylayın",
      confirmLabel: "Kaydet",
      input: { label: "Şifre", type: "password", validate: (v) => (v ? null : "Şifrenizi girin.") },
    });
    if (password == null) return;
    try {
      const { user: updated } = await api.updateEmail(email.trim() || null, password);
      onUserChange(updated);
      toast(email.trim() ? "E-posta kaydedildi" : "E-posta kaldırıldı");
    } catch (err) {
      await showError(err);
    }
  }

  async function deleteAccount() {
    const password = await dialog.prompt({
      title: "Hesabınız silinsin mi?",
      message:
        "Hesabınız ve size ait veriler kalıcı olarak silinir; bu geri alınamaz. Paylaşılan araçlara eklediğiniz kayıtlar o araçlarda kalır (ekleyen \"silinmiş kullanıcı\" görünür). İsterseniz önce Dışa Aktar ile verilerinizi indirin.",
      tone: "danger",
      confirmLabel: "Devam",
      input: { label: "Onaylamak için şifreniz", type: "password", validate: (v) => (v ? null : "Şifrenizi girin.") },
    });
    if (password == null) return;
    try {
      try {
        await api.deleteAccount(password);
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "has_vehicles")) throw err;
        const sure = await dialog.confirm({
          title: "Araçlarınıza ne olacak?",
          message: err.message,
          tone: "danger",
          confirmLabel: "Hesabımı Sil",
        });
        if (!sure) return;
        await api.deleteAccount(password, true);
      }
      await dialog.alert({ title: "Hesabınız silindi", message: "Bu cihazdaki oturumunuz kapatıldı.", tone: "success" });
      onLogout();
    } catch (err) {
      await showError(err);
    }
  }

  async function editBudget() {
    const text = await dialog.prompt({
      title: "Aylık bütçe",
      message: "Bir ayda yakıt ve diğer araç masraflarına (tüm araçlarınız) en fazla ne kadar harcamak istiyorsunuz? Boş bırakırsanız bütçe kaldırılır.",
      confirmLabel: "Kaydet",
      input: {
        label: "Aylık bütçe (TL)",
        inputMode: "decimal",
        placeholder: user.monthlyBudget ? String(user.monthlyBudget) : "8000",
        validate: (value) => {
          if (!value.trim()) return null;
          const n = parseAmount(value);
          return Number.isFinite(n) && n > 0 ? null : "Geçerli bir tutar girin veya boş bırakın.";
        },
      },
    });
    if (text == null) return;
    try {
      const { user: updated } = await api.setBudget(text.trim() ? parseAmount(text) : null);
      onUserChange(updated);
      toast(text.trim() ? "Bütçe kaydedildi" : "Bütçe kaldırıldı");
    } catch (err) {
      await showError(err);
    }
  }

  async function updateOdometer(vehicle: Vehicle) {
    const current = latestKmByVehicle.get(vehicle.id) ?? null;
    const text = await dialog.prompt({
      title: "Güncel kilometre",
      message: "Dolum yapmadan aracın şu anki kilometresini girin; kilometreye bağlı hatırlatmalar buna göre güncellenir.",
      confirmLabel: "Kaydet",
      input: {
        label: "Kilometre",
        inputMode: "numeric",
        placeholder: current != null ? String(current) : "125000",
        validate: (value) => {
          const n = parseAmount(value);
          if (!Number.isFinite(n) || n <= 0) return "Geçerli bir kilometre girin.";
          if (current != null && n < current) return `Son kayıtlı ${current.toLocaleString("tr-TR")} km'den küçük olamaz.`;
          return null;
        },
      },
    });
    if (text == null) return;
    try {
      const updated = await api.updateOdometer(vehicle.id, parseAmount(text));
      setVehicles((prev) => prev?.map((v) => (v.id === updated.id ? updated : v)) ?? null);
      toast("Kilometre güncellendi");
    } catch (err) {
      await showError(err);
    }
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

  async function addEntry(fields: FuelEntryInput) {
    // The id is fixed before the first try, so a retry from the offline queue is recognised.
    const input = { ...fields, id: fields.id ?? crypto.randomUUID() };
    try {
      const entry = await api.createEntry(input);
      setEntries((prev) => [...prev, entry]);
      toast("Dolum kaydedildi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const id = enqueue("entry", input, user.id);
      setEntries((prev) => [...prev, placeholder<FuelEntry>(input, id)]);
      toast(OFFLINE_SAVED);
    }
  }

  /**
   * Deletes a record on the server; without a connection the delete is queued instead. A record
   * that never reached the server is simply dropped from the queue. True when it was queued.
   */
  async function removeOnServer(kind: OutboxKind, id: string): Promise<boolean> {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      dropFromOutbox(id);
      return false;
    }
    try {
      if (kind === "entry") await api.deleteEntry(id);
      else if (kind === "expense") await api.deleteExpense(id);
      else await api.deleteReminder(id);
      return false;
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      enqueueChange("delete", kind, id, null, user.id);
      return true;
    }
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
      const offline = await removeOnServer("entry", id);
      await animateOut(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      clearLeaving(id);
      toast(offline ? OFFLINE_SAVED : "Dolum silindi");
    } catch (err) {
      await showError(err);
    }
  }

  /** Sends one queued edit or delete; a record already gone from the server counts as deleted. */
  async function sendChange(op: "update" | "delete", kind: OutboxKind, id: string, input: unknown) {
    if (op === "delete") {
      try {
        if (kind === "entry") await api.deleteEntry(id);
        else if (kind === "expense") await api.deleteExpense(id);
        else await api.deleteReminder(id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
      return;
    }
    if (kind === "entry") {
      const saved = await api.updateEntry(id, input as FuelEntryInput);
      setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
    } else if (kind === "expense") {
      const saved = await api.updateExpense(id, input as ExpenseInput);
      setExpenses((prev) => prev.map((e) => (e.id === id ? saved : e)));
    } else {
      const saved = await api.updateReminder(id, input as ReminderInput);
      setReminders((prev) => prev.map((r) => (r.id === id ? saved : r)));
    }
  }

  // Send records that were added offline, as soon as there is a connection again.
  const flushing = useRef(false);
  const flushOutbox = useCallback(async () => {
    const items = readOutbox(user.id);
    if (flushing.current || !navigator.onLine || items.length === 0) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const item of items) {
        try {
          if (item.op === "update" || item.op === "delete") {
            await sendChange(item.op, item.kind, item.targetId!, item.input);
          } else if (item.kind === "entry") {
            const saved = await api.createEntry(item.input as FuelEntryInput);
            setEntries((prev) => prev.map((e) => (e.id === item.localId ? saved : e)));
          } else if (item.kind === "expense") {
            const saved = await api.createExpense(item.input as ExpenseInput);
            setExpenses((prev) => prev.map((e) => (e.id === item.localId ? saved : e)));
          } else {
            const saved = await api.createReminder(item.input as ReminderInput);
            setReminders((prev) => prev.map((r) => (r.id === item.localId ? saved : r)));
          }
          dropFromOutbox(item.localId);
          sent++;
        } catch (err) {
          if (isOfflineError(err)) break;
          // The server refused it (e.g. the vehicle is gone): drop it and say why.
          dropFromOutbox(item.localId);
          setEntries((prev) => prev.filter((e) => e.id !== item.localId));
          setExpenses((prev) => prev.filter((e) => e.id !== item.localId));
          setReminders((prev) => prev.filter((r) => r.id !== item.localId));
          await dialog.alert({ title: "Bekleyen kayıt gönderilemedi", message: errorMessage(err), tone: "danger" });
        }
      }
    } finally {
      flushing.current = false;
    }
    if (sent) toast(sent === 1 ? "Bekleyen kayıt gönderildi" : `${sent} bekleyen kayıt gönderildi`);
  }, [user.id, dialog]);
  useEffect(() => {
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushOutbox]);

  // Per vehicle: the owner may edit or delete any record there, helpers only their own.
  const canEditIn = (vehicle: Vehicle) => (record: { createdById: string | null }) =>
    vehicle.myRole === "owner" || record.createdById === user.id;

  async function updateEntry(id: string, input: FuelEntryInput) {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      replaceInOutbox(id, input);
      setEntries((prev) => prev.map((e) => (e.id === id ? placeholder<FuelEntry>(input, id) : e)));
      toast("Dolum güncellendi");
      return;
    }
    try {
      const entry = await api.updateEntry(id, input);
      setEntries((prev) => prev.map((e) => (e.id === id ? entry : e)));
      toast("Dolum güncellendi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      enqueueChange("update", "entry", id, input, user.id);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, id } : e)));
      toast(OFFLINE_SAVED);
    }
  }

  async function updateExpense(id: string, input: ExpenseInput) {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      replaceInOutbox(id, input);
      setExpenses((prev) => prev.map((e) => (e.id === id ? placeholder<Expense>(input, id) : e)));
      toast("Masraf güncellendi");
      return;
    }
    try {
      const expense = await api.updateExpense(id, input);
      setExpenses((prev) => prev.map((e) => (e.id === id ? expense : e)));
      toast("Masraf güncellendi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      enqueueChange("update", "expense", id, input, user.id);
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, id } : e)));
      toast(OFFLINE_SAVED);
    }
  }

  async function addReminder(fields: ReminderInput) {
    const input = { ...fields, id: fields.id ?? crypto.randomUUID() };
    try {
      const reminder = await api.createReminder(input);
      setReminders((prev) => [...prev, reminder]);
      toast("Hatırlatma eklendi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const id = enqueue("reminder", input, user.id);
      setReminders((prev) => [...prev, placeholder<Reminder>(input, id)]);
      toast(OFFLINE_SAVED);
    }
  }

  async function updateReminder(id: string, input: ReminderInput) {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      replaceInOutbox(id, input);
      setReminders((prev) => prev.map((r) => (r.id === id ? placeholder<Reminder>(input, id) : r)));
      toast("Hatırlatma güncellendi");
      return;
    }
    try {
      const reminder = await api.updateReminder(id, input);
      setReminders((prev) => prev.map((r) => (r.id === id ? reminder : r)));
      toast("Hatırlatma güncellendi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      enqueueChange("update", "reminder", id, input, user.id);
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...input, id } : r)));
      toast(OFFLINE_SAVED);
    }
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
      toast(result.expense ? "Tamamlandı, masraf eklendi" : "Hatırlatma tamamlandı");
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
      const offline = await removeOnServer("reminder", reminder.id);
      await animateOut(reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      clearLeaving(reminder.id);
      toast(offline ? OFFLINE_SAVED : "Hatırlatma silindi");
    } catch (err) {
      await showError(err);
    }
  }

  async function addExpense(fields: ExpenseInput) {
    const input = { ...fields, id: fields.id ?? crypto.randomUUID() };
    try {
      const expense = await api.createExpense(input);
      setExpenses((prev) => [...prev, expense]);
      toast("Masraf kaydedildi");
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const id = enqueue("expense", input, user.id);
      setExpenses((prev) => [...prev, placeholder<Expense>(input, id)]);
      toast(OFFLINE_SAVED);
    }
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
      const offline = await removeOnServer("expense", id);
      await animateOut(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      clearLeaving(id);
      toast(offline ? OFFLINE_SAVED : "Masraf silindi");
    } catch (err) {
      await showError(err);
    }
  }

  // Dashboard year (top bar), and each vehicle's highest odometer reading (reminder bell).
  const years = useMemo(() => dataYears(entries, expenses), [entries, expenses]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const latestKmByVehicle = useMemo(() => {
    const km = new Map<string, number | null>();
    for (const v of vehicles ?? []) if (v.odometerKm != null) km.set(v.id, v.odometerKm);
    for (const e of entries) {
      if (e.odometerKm != null && e.odometerKm > (km.get(e.vehicleId) ?? -1)) km.set(e.vehicleId, e.odometerKm);
    }
    return km;
  }, [entries, vehicles]);

  /** Vehicles this user owns; the plan's vehicle limit applies to these only. */
  const ownedCount = (vehicles ?? []).filter((v) => v.myRole === "owner").length;

  const currentVehicle = route.name === "vehicle" ? vehicles?.find((v) => v.id === route.id) : undefined;
  // Inside a vehicle the whole app (header included) takes that vehicle's fuel-type color.
  usePageAccent(currentVehicle ? FUEL_ACCENT[currentVehicle.fuelType] : null);
  // The add menu is always ready (the phone tab bar opens it anywhere); the floating + button only
  // shows on the home screen and vehicle pages.
  const showQuickAdd = Boolean(vehicles?.length);
  const showAddButton = route.name === "home" || currentVehicle != null;

  let page: React.ReactNode;
  if (vehicles == null) {
    page = loadError ? (
      <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
    ) : (
      <LoadingSkeleton />
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
    page = <NewVehiclePage catalog={catalog} onCreate={addVehicle} plan={planById(user.plan)} limit={vehicleLimit(user)} ownedCount={ownedCount} />;
  } else if (route.name === "plans") {
    page = (
      <PlansPage
        user={user}
        ownedCount={ownedCount}
        onChoose={async (plan) => {
          const { user: updated } = await api.choosePlan(plan.id);
          onUserChange(updated);
        }}
      />
    );
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
        onUpdateOdometer={() => updateOdometer(vehicle)}
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
    // Home; the year-in-review opens on top of it.
    page = (
      <HomePage
        vehicles={vehicles}
        entries={entries}
        expenses={expenses}
        reminders={reminders}
        year={year}
        years={years}
        plan={planById(user.plan)}
        limit={vehicleLimit(user)}
        budget={user.monthlyBudget}
        onEditBudget={editBudget}
        onYearChange={setYear}
        onReload={reload}
        onExport={() => setExportFor("")}
      />
    );
  }

  const wrapped =
    route.name === "wrapped" && vehicles ? yearSummary(route.year, vehicles, entries, expenses) : null;

  const isHome = route.name === "home";

  return (
    <div className="lg:flex">
      <AppSidebar
        user={user}
        route={route}
        vehicles={vehicles ?? []}
        wrappedYear={wrappedYear(entries)}
        onExport={() => setExportFor("")}
      />
      <div
        className={`mx-auto w-full min-w-0 flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pt-6 ${
          isHome ? "max-w-[96rem]" : "max-w-5xl lg:max-w-6xl"
        } ${
          // Room for the floating + button and, on vehicle pages, the phone tab bar.
          currentVehicle ? "pb-40 sm:pb-24" : "pb-28 sm:pb-24"
        }`}
      >
      <header className="relative z-30 mb-6 flex items-center justify-between gap-3 [view-transition-name:app-header]">
        <a href={paths.home} className="inline-flex shrink-0 items-center gap-2 lg:hidden">
          <div className="rounded-lg bg-brand-600 p-2 text-white">
            <Fuel size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CarLog</h1>
        </a>
        <div className="hidden min-w-0 flex-1 md:block">
          {vehicles ? <SearchBox vehicles={vehicles} entries={entries} expenses={expenses} reminders={reminders} /> : null}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {isHome && vehicles?.length ? (
            <div className="hidden sm:block">
              <YearSelect years={years} value={year} onChange={setYear} />
            </div>
          ) : null}
          <ThemeToggle className="h-9 w-9 justify-center rounded-xl px-0 [&>span]:hidden [&>svg]:h-[19px] [&>svg]:w-[19px]" />
          {vehicles?.length ? (
            <button
              type="button"
              onClick={() => setPhoneSearch((s) => !s)}
              aria-label="Ara"
              aria-expanded={phoneSearch}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {phoneSearch ? <X size={19} /> : <Search size={19} />}
            </button>
          ) : null}
          {vehicles ? <ReminderBell vehicles={vehicles} reminders={reminders} latestKmByVehicle={latestKmByVehicle} /> : null}
          <UserMenu user={user} onLogout={onLogout} onChangePassword={() => setChangingPassword(true)} onDeleteAccount={deleteAccount} onEditEmail={editEmail} />
        </div>
      </header>
      {phoneSearch && vehicles ? (
        <div className="pop-in relative z-30 -mt-3 mb-5 md:hidden">
          <SearchBox
            vehicles={vehicles}
            entries={entries}
            expenses={expenses}
            reminders={reminders}
            autoFocus
            onDone={() => setPhoneSearch(false)}
          />
        </div>
      ) : null}

      <Suspense fallback={<LoadingSkeleton />}>{page}</Suspense>

      {vehicles && !currentVehicle ? (
        <AppBottomNav
          user={user}
          route={route}
          vehicles={vehicles}
          wrappedYear={wrappedYear(entries)}
          onExport={() => setExportFor("")}
          onChangePassword={() => setChangingPassword(true)}
          onLogout={onLogout}
          onDeleteAccount={deleteAccount}
          onEditEmail={editEmail}
        />
      ) : null}
      {changingPassword ? <PasswordDialog onClose={() => setChangingPassword(false)} /> : null}
      <Toaster />
      <PullToRefresh
        onRefresh={async () => {
          // Send anything added offline first, then fetch what others added meanwhile.
          await flushOutbox();
          await reload();
          toast("Güncellendi");
        }}
      />
      <OnlineStatus pending={readOutbox(user.id).length} />

      {wrapped && wrapped.fillCount > 0 ? (
        <Suspense fallback={null}>
          <WrappedStories summary={wrapped} userName={user.username} onClose={() => navigate(paths.home)} />
        </Suspense>
      ) : null}

      {showQuickAdd && vehicles ? (
        <QuickAdd
          vehicles={vehicles}
          entries={entries}
          currentVehicleId={currentVehicle?.id}
          aboveTabBar={currentVehicle != null}
          hideOnPhone={!currentVehicle}
          hideButton={!showAddButton}
          onAddEntry={addEntry}
          onAddExpense={addExpense}
          onAddReminder={addReminder}
        />
      ) : null}

      {exportFor !== undefined && vehicles ? (
        <Suspense fallback={null}>
        <ExportDialog
          vehicles={vehicles}
          entries={entries}
          expenses={expenses}
          reminders={reminders}
          defaultVehicleId={exportFor || undefined}
          plan={user.plan}
          username={user.username}
          onClose={() => setExportFor(undefined)}
        />
        </Suspense>
      ) : null}
      </div>
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
