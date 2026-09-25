import { useCallback, useEffect, useState } from "react";
import { Fuel, LogOut, ShieldCheck, UserRound, Users } from "lucide-react";
import BackLink from "./components/BackLink";
import { api, errorMessage, UNAUTHORIZED_EVENT } from "./lib/api";
import { navigate, paths, useHashRoute } from "./lib/router";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import NewVehiclePage from "./pages/NewVehiclePage";
import UsersPage from "./pages/UsersPage";
import VehiclePage from "./pages/VehiclePage";
import type { FuelEntry, FuelEntryInput, User, Vehicle, VehicleInput } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "setup" }
  | { status: "login" }
  | { status: "ready"; user: User };

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const checkAuth = useCallback(() => {
    api
      .authStatus()
      .then(({ needsSetup, user }) =>
        setAuth(user ? { status: "ready", user } : { status: needsSetup ? "setup" : "login" }),
      )
      .catch((err) => setAuth({ status: "error", message: errorMessage(err) }));
  }, []);

  useEffect(checkAuth, [checkAuth]);

  useEffect(() => {
    const onUnauthorized = () => setAuth({ status: "login" });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

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
  if (auth.status === "setup" || auth.status === "login") {
    return <AuthPage mode={auth.status} onAuthenticated={(user) => setAuth({ status: "ready", user })} />;
  }

  return (
    <SignedInApp
      user={auth.user}
      onLogout={async () => {
        await api.logout().catch(() => undefined);
        navigate(paths.home);
        setAuth({ status: "login" });
      }}
    />
  );
}

function SignedInApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const route = useHashRoute();
  const isAdmin = user.role === "admin";

  const reload = useCallback(async () => {
    try {
      const [v, e] = await Promise.all([api.listVehicles(), api.listEntries()]);
      setVehicles(v);
      setEntries(e);
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

  let page: React.ReactNode;
  if (vehicles == null) {
    page = loadError ? (
      <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
    ) : (
      <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
    );
  } else if (route.name === "users") {
    page = isAdmin ? <UsersPage currentUser={user} /> : <NotAllowed />;
  } else if (route.name === "new-vehicle") {
    page = <NewVehiclePage onCreate={addVehicle} />;
  } else if (route.name === "vehicle") {
    const vehicle = vehicles.find((v) => v.id === route.id);
    page = vehicle ? (
      <VehiclePage
        vehicle={vehicle}
        entries={entries.filter((e) => e.vehicleId === vehicle.id)}
        tab={route.tab}
        onAddEntry={addEntry}
        onUpdateVehicle={updateVehicle}
        onDeleteEntry={isAdmin ? deleteEntry : undefined}
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
    page = <HomePage vehicles={vehicles} entries={entries} isAdmin={isAdmin} onReload={reload} />;
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
            title={isAdmin ? "Admin" : "Kullanıcı"}
          >
            {isAdmin ? <ShieldCheck size={14} /> : <UserRound size={14} />}
            {user.username}
          </span>
          {isAdmin ? (
            <a
              href={paths.users}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Kullanıcılar</span>
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
