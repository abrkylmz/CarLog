import { useCallback, useEffect, useState } from "react";
import { Fuel, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import BackLink from "./components/BackLink";
import { api, errorMessage, UNAUTHORIZED_EVENT, type AdminSetupState } from "./lib/api";
import { navigate, paths, useHashRoute, type Route } from "./lib/router";
import { AdminAuthPage, UserAuthPage } from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import NewVehiclePage from "./pages/NewVehiclePage";
import UsersPage from "./pages/UsersPage";
import VehiclePage from "./pages/VehiclePage";
import type { Expense, ExpenseInput, FuelEntry, FuelEntryInput, User, Vehicle, VehicleInput } from "./types";

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
      <UserAuthPage onAuthenticated={onAuthenticated} />
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const isAdmin = user.role === "admin";

  const reload = useCallback(async () => {
    try {
      const [v, e, x] = await Promise.all([api.listVehicles(), api.listEntries(), api.listExpenses()]);
      setVehicles(v);
      setEntries(e);
      setExpenses(x);
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
      navigate(paths.home);
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  async function addEntry(input: FuelEntryInput) {
    const entry = await api.createEntry(input);
    setEntries((prev) => [...prev, entry]);
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Bu dolum kaydı silinecek. Emin misiniz?")) return;
    try {
      await api.deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  async function addExpense(input: ExpenseInput) {
    const expense = await api.createExpense(input);
    setExpenses((prev) => [...prev, expense]);
  }

  async function deleteExpense(id: string) {
    if (!window.confirm("Bu masraf kaydı silinecek. Emin misiniz?")) return;
    try {
      await api.deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      window.alert(errorMessage(err));
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
  } else if (route.name === "new-vehicle") {
    page = <NewVehiclePage onCreate={addVehicle} />;
  } else if (route.name === "vehicle") {
    const vehicle = vehicles.find((v) => v.id === route.id);
    page = vehicle ? (
      <VehiclePage
        vehicle={vehicle}
        entries={entries.filter((e) => e.vehicleId === vehicle.id)}
        expenses={expenses.filter((e) => e.vehicleId === vehicle.id)}
        tab={route.tab}
        onAddEntry={addEntry}
        onAddExpense={addExpense}
        onUpdateVehicle={updateVehicle}
        onDeleteEntry={isAdmin ? deleteEntry : undefined}
        onDeleteExpense={isAdmin ? deleteExpense : undefined}
        onDeleteVehicle={isAdmin ? deleteVehicle : undefined}
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
      <HomePage vehicles={vehicles} entries={entries} expenses={expenses} isAdmin={isAdmin} onReload={reload} />
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
