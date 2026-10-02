import { Car, Download, Fuel, Home, LayoutDashboard, Play, Plus } from "lucide-react";
import { paths, VEHICLE_TAB_LABELS, VEHICLE_TABS, type Route } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import type { User, Vehicle } from "../types";

interface Props {
  user: User;
  route: Route;
  vehicles: Vehicle[];
  /** Year offered for the year-in-review card, if there is anything to show. */
  wrappedYear: number | null;
  onExport: () => void;
}

const item =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition";
const idle = "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white";
const current = "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200";

/**
 * Desktop navigation: home, each vehicle (the open one unfolds into its tabs), and the
 * year-in-review at the bottom. Hidden on phones, which use the header and the bottom tab bar.
 */
export default function AppSidebar({ user, route, vehicles, wrappedYear, onExport }: Props) {
  const openId = route.name === "vehicle" ? route.id : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white/70 px-4 py-6 backdrop-blur lg:flex dark:border-slate-800 dark:bg-slate-950/70">
      <a href={paths.home} className="mb-8 flex items-center gap-3 px-2">
        <span className="rounded-xl bg-brand-600 p-2.5 text-white shadow-md shadow-brand-900/20">
          <Fuel size={22} />
        </span>
        <span>
          <span className="block text-lg font-bold leading-tight tracking-tight">CarLog</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Yakıt gideri takibi</span>
        </span>
      </a>

      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
        <a href={paths.home} className={`${item} ${route.name === "home" ? current : idle}`}>
          <Home size={19} />
          Ana Sayfa
        </a>

        {vehicles.length ? (
          <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Araçlarım
          </p>
        ) : null}
        {vehicles.map((v) => {
          const isOpen = v.id === openId;
          return (
            <div key={v.id} data-accent={FUEL_ACCENT[v.fuelType]}>
              <a href={paths.vehicle(v.id)} className={`${item} ${isOpen ? current : idle}`}>
                <Car size={19} className="shrink-0 text-brand-500" />
                <span className="truncate">{v.name}</span>
              </a>
              {isOpen && route.name === "vehicle" ? (
                <div className="mb-2 ml-[1.15rem] mt-1 flex flex-col border-l border-slate-200 pl-3 dark:border-slate-800">
                  {VEHICLE_TABS.map((tab) => (
                    <a
                      key={tab}
                      href={paths.vehicle(v.id, tab)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        route.tab === tab
                          ? "font-semibold text-brand-700 dark:text-brand-300"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      {VEHICLE_TAB_LABELS[tab]}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <a href={paths.newVehicle} className={`${item} ${route.name === "new-vehicle" ? current : idle} mt-1`}>
          <Plus size={19} />
          Araç Ekle
        </a>

        <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Diğer
        </p>
        <button type="button" onClick={onExport} className={`${item} ${idle} text-left`}>
          <Download size={19} />
          Dışa Aktar
        </button>
        {user.role === "admin" ? (
          <a href={paths.admin} className={`${item} ${route.name === "admin" ? current : idle}`}>
            <LayoutDashboard size={19} />
            Yönetici Paneli
          </a>
        ) : null}
      </nav>

      {wrappedYear != null ? (
        <a
          href={paths.wrapped(wrappedYear)}
          className="group relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-violet-900/20"
        >
          <span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
          <span className="relative flex items-center justify-between">
            <span className="text-2xl font-black tracking-tighter tabular-nums">{wrappedYear}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-violet-700 transition group-hover:scale-110">
              <Play size={14} className="translate-x-px" fill="currentColor" />
            </span>
          </span>
          <span className="relative mt-1 block text-sm font-semibold">Yıl Özetin hazır</span>
          <span className="relative block text-xs text-white/80">Kaç km, kaç litre, ne kadar?</span>
        </a>
      ) : null}
    </aside>
  );
}
